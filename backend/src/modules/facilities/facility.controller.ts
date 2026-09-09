import { Request, Response } from 'express';
import { prisma } from '../../index';
import { formatDoctorName } from '../patients/patient.controller';
import { AuthRequest } from '../../middleware/auth';
import { calculateOptimalRoutes, ROUTING_WEIGHTS, RouteRequest } from '../routing/routing.service';
import { broadcastFacilityAvailability, broadcastFacilityCapacity } from '../../events/socket';

let cachedFacilities: any = null;
let facilitiesCacheTimestamp = 0;
const FACILITIES_CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Server-side Facility Ownership & Authorization Guard
 * Verifies that the authenticated user is either an ADMIN or a DOCTOR
 * assigned to the target facility in the FacilityDoctor relation.
 */
async function checkFacilityAuthorization(
  req: AuthRequest,
  facilityId: string
): Promise<{ authorized: boolean; reason?: string; status?: number }> {
  if (!req.user) {
    return { authorized: false, reason: 'Authentication required', status: 401 };
  }

  // Superuser / Administrator bypass
  if (req.user.roles && req.user.roles.includes('ADMIN')) {
    return { authorized: true };
  }

  // Must be an authentic doctor with a derived doctorId
  if (!req.user.doctorId) {
    return {
      authorized: false,
      reason: 'Doctor or administrator authorization required to manage facility operational parameters',
      status: 403
    };
  }

  // Verify authentic doctor-to-facility assignment in PostgreSQL
  const assignment = await prisma.facilityDoctor.findUnique({
    where: {
      facilityId_doctorId: {
        facilityId,
        doctorId: req.user.doctorId
      }
    }
  });

  if (!assignment) {
    return {
      authorized: false,
      reason: 'You are not assigned to manage this facility',
      status: 403
    };
  }

  return { authorized: true };
}

// 17. FACILITY MODEL: expose operational capabilities
export const getFacilities = async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cachedFacilities && now - facilitiesCacheTimestamp < FACILITIES_CACHE_TTL_MS) {
      return res.json(cachedFacilities);
    }

    const facilities = await prisma.facility.findMany({
      include: {
        services: true,
        capacities: true,
        availability: true,
        doctors: {
          include: {
            doctor: {
              include: {
                specialist: true,
                user: { select: { id: true, email: true } }
              }
            }
          }
        }
      }
    });

    const enriched = facilities.map(fac => ({
      ...fac,
      doctors: fac.doctors.map(fd => ({
        ...fd,
        doctor: fd.doctor ? {
          ...fd.doctor,
          name: formatDoctorName(fd.doctor),
          specialty: fd.doctor.specialist?.specialty || 'General Medicine'
        } : null
      }))
    }));

    cachedFacilities = enriched;
    facilitiesCacheTimestamp = now;

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateFacilityAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, readinessScore } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'Facility ID is required' });
    }

    const facility = await prisma.facility.findUnique({ where: { id } });
    if (!facility) {
      return res.status(404).json({ error: 'Not Found', message: 'Facility not found' });
    }

    // Server-side Facility Ownership Verification
    const authCheck = await checkFacilityAuthorization(req, id);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({
        error: 'Forbidden',
        message: authCheck.reason
      });
    }

    const validStatuses = ['OPEN', 'CLOSED', 'OVERCAPACITY'];
    const cleanStatus = status ? String(status).toUpperCase().trim() : 'OPEN';
    if (!validStatuses.includes(cleanStatus)) {
      return res.status(400).json({ error: 'Bad Request', message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    let cleanScore: number | undefined = undefined;
    if (readinessScore !== undefined && readinessScore !== null) {
      const scoreNum = Number(readinessScore);
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        return res.status(400).json({ error: 'Bad Request', message: 'Readiness score must be a number between 0 and 100' });
      }
      cleanScore = scoreNum;
    }

    const availability = await prisma.$transaction(async (tx) => {
      const avail = await tx.facilityAvailability.upsert({
        where: { facilityId: id },
        update: { status: cleanStatus, readinessScore: cleanScore },
        create: { facilityId: id, status: cleanStatus, readinessScore: cleanScore ?? 80 }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'UPDATE_AVAILABILITY',
          resource: 'FacilityAvailability',
          resourceId: avail.id
        }
      });

      return avail;
    });

    cachedFacilities = null;

    // Part B & F: Emit realtime event only after successful DB transaction
    broadcastFacilityAvailability(id, {
      status: availability.status,
      readinessScore: availability.readinessScore,
      updatedAt: availability.updatedAt,
      entityId: availability.id
    });

    res.json(availability);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Phase 2: Real PostgreSQL-backed Capacity Mutation
 * Updates total and/or occupied capacity for a facility resource.
 * Enforces server-side authorization, non-negativity, integer validation,
 * and logical boundary (occupied <= total).
 */
export const updateFacilityCapacity = async (req: AuthRequest, res: Response) => {
  try {
    const { id, capacityId } = req.params;
    const { total, occupied } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'Facility ID is required' });
    }
    if (!capacityId || typeof capacityId !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'Capacity ID is required' });
    }

    const facility = await prisma.facility.findUnique({ where: { id } });
    if (!facility) {
      return res.status(404).json({ error: 'Not Found', message: 'Facility not found' });
    }

    // Server-side Facility Ownership Verification
    const authCheck = await checkFacilityAuthorization(req, id);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({
        error: 'Forbidden',
        message: authCheck.reason
      });
    }

    // Verify capacityId belongs to this facility
    const existingCapacity = await prisma.facilityCapacity.findFirst({
      where: { id: capacityId, facilityId: id }
    });
    if (!existingCapacity) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Capacity resource not found for this facility'
      });
    }

    if (total === undefined && occupied === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'At least one of total or occupied must be provided'
      });
    }

    let newTotal = existingCapacity.total;
    if (total !== undefined) {
      if (typeof total !== 'number' || !Number.isInteger(total)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Total capacity must be an integer'
        });
      }
      if (total < 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Total capacity cannot be negative'
        });
      }
      newTotal = total;
    }

    let newOccupied = existingCapacity.occupied;
    if (occupied !== undefined) {
      if (typeof occupied !== 'number' || !Number.isInteger(occupied)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Occupied capacity must be an integer'
        });
      }
      if (occupied < 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Occupied capacity cannot be negative'
        });
      }
      newOccupied = occupied;
    }

    // Logical integrity: occupied cannot exceed total
    if (newOccupied > newTotal) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Occupied capacity (${newOccupied}) cannot exceed total capacity (${newTotal})`
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cap = await tx.facilityCapacity.update({
        where: { id: capacityId },
        data: {
          total: newTotal,
          occupied: newOccupied
        }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          action: 'UPDATE_CAPACITY',
          resource: 'FacilityCapacity',
          resourceId: cap.id
        }
      });

      return cap;
    });

    cachedFacilities = null;

    // Part B & E: Emit realtime event only after successful DB transaction
    broadcastFacilityCapacity(id, {
      capacityId: updated.id,
      category: updated.resource,
      total: updated.total,
      occupied: updated.occupied,
      available: updated.total - updated.occupied,
      updatedAt: updated.updatedAt
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Phase 3: Capability-Aware Facility Routing
 * Evaluates real live PostgreSQL facility models, live queue entries,
 * services, capacities, availability, and doctor/specialist presence.
 */
export const getFacilityRouting = async (req: AuthRequest, res: Response) => {
  try {
    const {
      urgency,
      requiredSpecialty,
      specialty,
      requiredService,
      requiredBedType,
      patientLocation,
      excludeFacilityIds,
      maxDistanceKm,
      limit
    } = req.body || {};

    // Input Validation
    const validUrgencies = ['ROUTINE', 'PRIORITY', 'URGENT', 'EMERGENCY'];
    if (urgency && !validUrgencies.includes(String(urgency).toUpperCase())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid urgency level. Must be one of: ${validUrgencies.join(', ')}`
      });
    }

    const validBedTypes = ['GENERAL', 'ICU', 'OXYGEN', 'MATERNITY', 'NICU'];
    if (requiredBedType && !validBedTypes.includes(String(requiredBedType).toUpperCase())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid bed type. Must be one of: ${validBedTypes.join(', ')}`
      });
    }

    const rootLat = req.body?.latitude ?? req.body?.lat;
    const rootLon = req.body?.longitude ?? req.body?.lng ?? req.body?.lon;
    if (rootLat !== undefined && (typeof rootLat !== 'number' || isNaN(rootLat) || rootLat < -90 || rootLat > 90)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid latitude. Must be between -90 and 90'
      });
    }
    if (rootLon !== undefined && (typeof rootLon !== 'number' || isNaN(rootLon) || rootLon < -180 || rootLon > 180)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid longitude. Must be between -180 and 180'
      });
    }

    if (patientLocation !== undefined && patientLocation !== null) {
      if (typeof patientLocation !== 'object') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'patientLocation must be an object with latitude and longitude'
        });
      }
      const lat = patientLocation.latitude ?? patientLocation.lat;
      const lon = patientLocation.longitude ?? patientLocation.lng ?? patientLocation.lon;
      if (lat !== undefined && (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid latitude in patientLocation. Must be between -90 and 90'
        });
      }
      if (lon !== undefined && (typeof lon !== 'number' || isNaN(lon) || lon < -180 || lon > 180)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid longitude in patientLocation. Must be between -180 and 180'
        });
      }
    }

    if (excludeFacilityIds !== undefined && !Array.isArray(excludeFacilityIds)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'excludeFacilityIds must be an array of facility IDs'
      });
    }

    if (maxDistanceKm !== undefined && (typeof maxDistanceKm !== 'number' || isNaN(maxDistanceKm) || maxDistanceKm <= 0)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'maxDistanceKm must be a positive number'
      });
    }

    if (limit !== undefined && (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'limit must be a positive integer'
      });
    }

    const routingParams: RouteRequest = {
      urgency: urgency ? String(urgency).toUpperCase() : 'ROUTINE',
      requiredSpecialty: requiredSpecialty || specialty,
      requiredService,
      requiredBedType: requiredBedType ? String(requiredBedType).toUpperCase() : undefined,
      patientLocation,
      excludeFacilityIds,
      maxDistanceKm,
      limit
    };

    const ranked = await calculateOptimalRoutes(routingParams);

    const totalEvaluated = ranked.length;
    const eligibleCount = ranked.filter((f) => f.eligible).length;
    const ineligibleCount = totalEvaluated - eligibleCount;
    const hasCalculatedDistance = ranked.some((f) => f.distanceStatus === 'CALCULATED');
    const distanceHandling = hasCalculatedDistance ? 'CALCULATED' : 'NOT_SUPPORTED_BY_SCHEMA';

    return res.json({
      ranked_facilities: ranked,
      meta: {
        totalEvaluated,
        eligibleCount,
        ineligibleCount,
        urgency: routingParams.urgency,
        weightsUsed: ROUTING_WEIGHTS,
        distanceHandling
      }
    });
  } catch (error: any) {
    console.error('Error calculating facility routing:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


