import { Request, Response } from 'express';
import { calculateOptimalRoutes, RouteRequest } from './routing.service';
import { prisma } from '../../index';

export async function handleFindNearbyCare(req: Request, res: Response) {
  try {
    const {
      latitude,
      longitude,
      lat,
      lng,
      requiredBedType,
      requiredSpecialty,
      requiredService,
      urgency = 'ROUTINE',
      limit = 5
    } = req.body;

    const patientLat = latitude ?? lat ?? 18.1507; // Default to Baramati rural coordinates if unspecified
    const patientLng = longitude ?? lng ?? 74.5768;

    const routeParams: RouteRequest = {
      patientLocation: {
        latitude: Number(patientLat),
        longitude: Number(patientLng)
      },
      requiredBedType,
      requiredSpecialty,
      requiredService,
      urgency,
      limit: Number(limit)
    };

    const routes = await calculateOptimalRoutes(routeParams, prisma);

    const formattedFacilities = routes.map(r => ({
      facilityId: r.facilityId,
      facilityName: r.facilityName,
      facilityType: r.facilityType,
      level: r.level,
      distanceKm: r.distance_km !== null ? Number(r.distance_km.toFixed(2)) : null,
      travelTimeLabel: r.estimated_travel_time_minutes !== null ? `${r.estimated_travel_time_minutes} mins (ESTIMATED)` : 'ESTIMATED',
      readinessScore: r.readiness_score,
      queueLoad: r.active_queue_count,
      bedCapacities: r.capacities_summary,
      isEligible: r.isEligible,
      reasons: r.reasons,
      factors: r.factors,
      whySelected: r.reasons && r.reasons.length > 0 ? r.reasons[0] : 'Optimal geographic proximity and clinical readiness',
      lastUpdated: new Date().toISOString()
    }));

    return res.status(200).json({
      total: formattedFacilities.length,
      patientLocation: { latitude: patientLat, longitude: patientLng },
      facilities: formattedFacilities
    });
  } catch (error: any) {
    console.error('[Routing Controller] Error finding nearby care:', error);
    return res.status(500).json({ error: error.message || 'Error calculating facility routes' });
  }
}

