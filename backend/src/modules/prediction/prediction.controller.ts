import { Request, Response } from 'express';
import { prisma } from '../../index';
import {
  auditDataSufficiency,
  predictQueuePressure,
  predictCapacityPressure,
  predictReferralDelayRisk,
  predictFollowUpOverload,
  getDiagnosticForecastingNotice,
  getMedicineStockoutForecastingNotice,
  evaluateModelPerformance,
  getDistrictOperationalPredictionsSummary
} from './prediction.service';
import { checkFacilityAnalyticsAuthorization } from '../analytics/analytics.controller';

/**
 * GET /api/predictions/audit
 * Phase 0: Data Sufficiency Audit across all potential prediction domains
 */
export const getDataSufficiencyAudit = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.roles?.includes('PATIENT')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Patients are not permitted to access operational prediction audits'
      });
    }

    const report = await auditDataSufficiency();
    res.json(report);
  } catch (error) {
    console.error('Error in getDataSufficiencyAudit:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/predictions/operations
 * District-wide operational prediction summary for CMOs and administrators
 */
export const getOperationalPredictionsSummary = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.roles?.includes('PATIENT')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Patients are not permitted to access district operational predictions'
      });
    }

    const summary = await getDistrictOperationalPredictionsSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error in getOperationalPredictionsSummary:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/predictions/facilities/:id
 * Complete predictive profile for a single facility (Queue + Capacity)
 */
export const getFacilityPredictions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'Facility ID is required' });
    }

    // Verify facility exists
    const facility = await prisma.facility.findUnique({
      where: { id },
      select: { id: true, name: true }
    });
    if (!facility) {
      return res.status(404).json({ error: 'Not Found', message: `Facility with ID ${id} not found` });
    }

    // IDOR & Authorization Guard
    const auth = await checkFacilityAnalyticsAuthorization(req, id);
    if (!auth.authorized) {
      return res.status(auth.status).json({
        error: auth.status === 401 ? 'Unauthorized' : 'Forbidden',
        message: auth.message
      });
    }

    const [queuePressure, capacityPressure] = await Promise.all([
      predictQueuePressure(id, 2),
      predictCapacityPressure(id, undefined, 6)
    ]);

    res.json({
      facilityId: id,
      facilityName: facility.name,
      generatedAt: new Date().toISOString(),
      queuePressure,
      capacityPressure
    });
  } catch (error) {
    console.error('Error in getFacilityPredictions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/predictions/queue
 * Queue pressure prediction with horizon
 */
export const getQueuePressurePrediction = async (req: Request, res: Response) => {
  try {
    const { facilityId, horizon } = req.query;

    if (!facilityId || typeof facilityId !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'facilityId query parameter is required' });
    }

    // IDOR & Authorization Guard
    const auth = await checkFacilityAnalyticsAuthorization(req, facilityId);
    if (!auth.authorized) {
      return res.status(auth.status).json({
        error: auth.status === 401 ? 'Unauthorized' : 'Forbidden',
        message: auth.message
      });
    }

    const horizonHours = horizon ? parseInt(String(horizon), 10) : 2;
    if (isNaN(horizonHours) || horizonHours <= 0 || horizonHours > 48) {
      return res.status(400).json({ error: 'Bad Request', message: 'horizon must be an integer between 1 and 48 hours' });
    }

    const result = await predictQueuePressure(facilityId, horizonHours);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    console.error('Error in getQueuePressurePrediction:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/predictions/capacity
 * Capacity pressure prediction by resource category
 */
export const getCapacityPressurePrediction = async (req: Request, res: Response) => {
  try {
    const { facilityId, category, horizon } = req.query;

    if (!facilityId || typeof facilityId !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'facilityId query parameter is required' });
    }

    // IDOR & Authorization Guard
    const auth = await checkFacilityAnalyticsAuthorization(req, facilityId);
    if (!auth.authorized) {
      return res.status(auth.status).json({
        error: auth.status === 401 ? 'Unauthorized' : 'Forbidden',
        message: auth.message
      });
    }

    const horizonHours = horizon ? parseInt(String(horizon), 10) : 6;
    const targetCategory = category ? String(category).toUpperCase() : undefined;

    const result = await predictCapacityPressure(facilityId, targetCategory, horizonHours);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: error.message });
    }
    console.error('Error in getCapacityPressurePrediction:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/predictions/referrals
 * Referral delay risk prediction
 */
export const getReferralDelayRiskPrediction = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.roles?.includes('PATIENT')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Patients are not permitted to access inter-facility referral delay forecasting'
      });
    }

    const { originId, destinationId, urgency } = req.query;

    const result = await predictReferralDelayRisk({
      originId: originId ? String(originId) : undefined,
      destinationId: destinationId ? String(destinationId) : undefined,
      urgency: urgency ? String(urgency) : 'URGENT'
    });

    res.json(result);
  } catch (error) {
    console.error('Error in getReferralDelayRiskPrediction:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/predictions/diagnostics
 * Diagnostic demand forecasting notice (Schema limitation)
 */
export const getDiagnosticWorkloadPrediction = async (req: Request, res: Response) => {
  try {
    const notice = getDiagnosticForecastingNotice();
    res.json(notice);
  } catch (error) {
    console.error('Error in getDiagnosticWorkloadPrediction:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/predictions/followups
 * Frontline worker follow-up overload prediction
 */
export const getFollowUpOverloadPrediction = async (req: Request, res: Response) => {
  try {
    const { workerId, horizonDays } = req.query;
    const horizon = horizonDays ? parseInt(String(horizonDays), 10) : 3;

    const result = await predictFollowUpOverload(
      workerId ? String(workerId) : undefined,
      horizon
    );

    res.json(result);
  } catch (error) {
    console.error('Error in getFollowUpOverloadPrediction:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/predictions/evaluation
 * Backtesting & model accuracy evaluation
 */
export const getModelEvaluation = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.roles?.includes('PATIENT')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Patients are not permitted to access model evaluation telemetry'
      });
    }

    const { target } = req.query;
    const metrics = await evaluateModelPerformance(target ? String(target).toUpperCase() : 'QUEUE');
    res.json(metrics);
  } catch (error) {
    console.error('Error in getModelEvaluation:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

