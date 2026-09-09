import { Request, Response } from 'express';
import { prisma } from '../../index';
import {
  getFacilityOperationalMetrics,
  getFacilityPerformanceIndicators,
  getReferralBottleneckAnalytics,
  getDiagnosticOperationsAnalytics,
  getFollowUpBurdenAnalytics,
  getDistrictOperationsOverview
} from './analytics.service';

let cachedMetrics: any = null;
let cacheTimestamp = 0;
const METRICS_CACHE_TTL_MS = 5000; // 5 seconds cache

/**
 * Cleaned backward-compatible dashboard metrics endpoint.
 * Strictly eliminates static fake forecasts (medicine_stockout_risk, diagnostic_demand_forecast).
 * Preserves 'actual' keys for seamless Dashboard.tsx compatibility.
 */
export const getDashboardMetrics = async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cachedMetrics && now - cacheTimestamp < METRICS_CACHE_TTL_MS) {
      return res.json(cachedMetrics);
    }

    // Parallel queries to PostgreSQL
    const [totalPatients, activeAssessments, pendingReferrals, patientsInQueue, operationalSummary] = await Promise.all([
      prisma.patient.count(),
      prisma.assessment.count(),
      prisma.referral.count({
        where: {
          status: { in: ['CREATED', 'SUBMITTED', 'ACCEPTED'] }
        }
      }),
      prisma.queueEntry.count({
        where: {
          status: { in: ['WAITING', 'PRIORITY', 'IN_CONSULTATION'] }
        }
      }),
      getFacilityOperationalMetrics().catch(() => null)
    ]);

    const payload = {
      actual: {
        totalPatients,
        activeAssessments,
        pendingReferrals,
        patientsInQueue
      },
      // Real descriptive operational telemetry replacing fake predictive values
      descriptive: {
        operationalSummary,
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'RULE_BASED_OPERATIONAL_ANALYZER',
          source: 'PostgreSQL'
        }
      },
      // Preserved empty structure for backward-compatibility without fake data (C=0, D=0)
      predicted: {
        medicine_stockout_risk: [],
        diagnostic_demand_forecast: [],
        metadata: {
          generated_at: new Date().toISOString(),
          model: 'RULE_BASED_OPERATIONAL_ANALYZER',
          notice: 'Predictive forecasting is deferred to Phase 6. Real descriptive telemetry active.'
        }
      }
    };

    cachedMetrics = payload;
    cacheTimestamp = now;

    res.json(payload);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Server-side Facility Analytics Authorization Guard
 * Verifies that the authenticated user is either an ADMIN,
 * a DOCTOR assigned via FacilityDoctor, or a WORKER assigned via Worker.facilityId.
 * Blocks PATIENT role with 403 Forbidden.
 */
export async function checkFacilityAnalyticsAuthorization(
  req: any,
  facilityId: string
): Promise<{ authorized: boolean; status: number; message: string }> {
  if (!req.user) {
    return { authorized: false, status: 401, message: 'Authentication required' };
  }

  // Patients are strictly blocked from internal facility performance analytics
  if (req.user.roles && req.user.roles.includes('PATIENT')) {
    return { authorized: false, status: 403, message: 'Patients are not permitted to access facility operational analytics' };
  }

  // Admins have district-wide access
  if (req.user.roles && req.user.roles.includes('ADMIN')) {
    return { authorized: true, status: 200, message: 'Authorized' };
  }

  // If user is a Doctor, verify assignment via FacilityDoctor
  if (req.user.doctorId) {
    const assignment = await prisma.facilityDoctor.findUnique({
      where: {
        facilityId_doctorId: {
          facilityId,
          doctorId: req.user.doctorId
        }
      }
    });
    if (!assignment) {
      return { authorized: false, status: 403, message: 'Cross-facility IDOR defense: Doctor is not assigned to this facility' };
    }
    return { authorized: true, status: 200, message: 'Authorized' };
  }

  // If user is a Worker, verify assignment via Worker.facilityId
  if (req.user.workerId) {
    const worker = await prisma.worker.findUnique({
      where: { id: req.user.workerId }
    });
    if (!worker || worker.facilityId !== facilityId) {
      return { authorized: false, status: 403, message: 'Cross-facility IDOR defense: Worker is not assigned to this facility' };
    }
    return { authorized: true, status: 200, message: 'Authorized' };
  }

  return { authorized: false, status: 403, message: 'Unauthorized facility access' };
}

/**
 * GET /api/analytics/operations
 * System overview: District-level operational metrics (facilities, capacities, active queues)
 */
export const getOperationsSummary = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.roles?.includes('PATIENT')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Patients are not permitted to access operational telemetry'
      });
    }

    const summary = await getFacilityOperationalMetrics();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching operations summary:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/analytics/facilities
 * Performance indicators for all facilities across the district
 */
export const listFacilityAnalytics = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.roles?.includes('PATIENT')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Patients are not permitted to access facility performance analytics'
      });
    }

    const indicators = await getFacilityPerformanceIndicators();
    res.json(indicators);
  } catch (error) {
    console.error('Error listing facility analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/analytics/facilities/:id
 * Detailed operational indicators for a specific facility with IDOR protection & validation
 */
export const getFacilityAnalyticsById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'Facility ID is required' });
    }

    // Verify facility exists in PostgreSQL
    const facilityExists = await prisma.facility.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!facilityExists) {
      return res.status(404).json({ error: 'Not Found', message: `Facility with ID ${id} not found` });
    }

    // Authorization & IDOR check
    const auth = await checkFacilityAnalyticsAuthorization(req, id);
    if (!auth.authorized) {
      return res.status(auth.status).json({
        error: auth.status === 401 ? 'Unauthorized' : 'Forbidden',
        message: auth.message
      });
    }

    const indicators = await getFacilityPerformanceIndicators(id);
    if (!indicators || indicators.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Facility with ID ${id} not found` });
    }

    res.json(indicators[0]);
  } catch (error) {
    console.error('Error fetching facility analytics by ID:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/analytics/referrals
 * Referral bottleneck intelligence, inter-facility transfer corridors, and stuck referrals
 */
export const getReferralAnalytics = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.roles?.includes('PATIENT')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Patients are not permitted to access inter-facility referral analytics'
      });
    }

    const { originId, destinationId, urgency } = req.query;

    const analytics = await getReferralBottleneckAnalytics({
      originId: originId ? String(originId) : undefined,
      destinationId: destinationId ? String(destinationId) : undefined,
      urgency: urgency ? String(urgency) : undefined
    });

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching referral analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/analytics/diagnostics
 * Diagnostic operations: Test demand, order statuses, and schema limitation notes
 */
export const getDiagnosticAnalytics = async (req: Request, res: Response) => {
  try {
    const analytics = await getDiagnosticOperationsAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching diagnostic analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/analytics/followups
 * Community care burden: Pending, overdue, and completed follow-ups by worker and facility
 */
export const getFollowUpAnalytics = async (req: Request, res: Response) => {
  try {
    const { facilityId } = req.query;
    const analytics = await getFollowUpBurdenAnalytics(facilityId ? String(facilityId) : undefined);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching follow-up analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/analytics/district
 * District-level aggregate overview for CMOs and health administrators
 */
export const getDistrictOverview = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.roles?.includes('PATIENT')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Patients are not permitted to access district operational intelligence'
      });
    }

    const overview = await getDistrictOperationsOverview();
    res.json(overview);
  } catch (error) {
    console.error('Error fetching district overview:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

