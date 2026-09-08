import { prisma } from '../../index';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../index';

// 43. INTELLIGENT ROUTING ENGINE
export const getOptimalFacilities = async (patientLat: number, patientLon: number, requiredSpecialty?: string) => {
  try {
    // 1. Fetch available facilities
    const facilities = await prisma.facility.findMany({
      include: {
        services: true,
        availability: true
export interface RoutePatientLocation {
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  lon?: number | null;
}

export interface RouteRequest {
  condition?: string;
  urgency?: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | string;
  requiredSpecialty?: string;
  specialty?: string;
  requiredService?: string;
  patientLocation?: RoutePatientLocation | null;
  originFacilityId?: string;
}

export interface RoutingFactors {
  base_score: number;
  readiness: number;
  availability: number;
  service_match: number;
  specialty_match: number;
  capacity: number;
  urgency_suitability: number;
  queue_penalty: number;
  distance_penalty: number;
}

export interface CapacityResourceSummary {
  total: number;
  occupied: number;
  available: number;
}

export interface FacilityRouteResult {
  facility_id: string;
  facility_name: string;
  type: string;
  level: number;
  distance_km: number | null;
  estimated_travel_time_minutes: number | null;
  score: number;
  readiness_score: number;
  is_alternative: boolean;
  freshness_penalty_applied: boolean;
  reasons: string[];
  factors: RoutingFactors;
  active_queue_count: number;
  capacities_summary: {
    general_beds: CapacityResourceSummary;
    icu_beds: CapacityResourceSummary;
    oxygen_beds: CapacityResourceSummary;
    maternity_beds: CapacityResourceSummary;
    nicu_beds: CapacityResourceSummary;
    total_beds: number;
    total_occupied: number;
    total_available: number;
  };
}

export const ROUTING_WEIGHTS = {
  BASE_SCORE: 50,
  READINESS_FACTOR: 0.3,
  AVAILABILITY: {
    OPEN: 10,
    OVERCAPACITY_PENALTY: -25,
    CLOSED_PENALTY: -80,
  },
  SERVICE_MATCH_BOOST: 20,
  SPECIALTY_ON_SITE_DOCTOR_BOOST: 20,
  SPECIALTY_SERVICE_BOOST: 15,
  CAPACITY: {
    ICU_BED_AVAILABLE_BOOST: 12,
    GENERAL_BED_AVAILABLE_BOOST: 6,
    OXYGEN_BED_AVAILABLE_BOOST: 8,
    MATERNITY_BED_AVAILABLE_BOOST: 5,
    NICU_BED_AVAILABLE_BOOST: 8,
    ALL_CAPACITY_EXHAUSTED_PENALTY: -20,
  },
  LEVEL_BOOST: {
    LEVEL_3_TERTIARY: 10,
    LEVEL_2_SECONDARY: 5,
    LEVEL_1_PRIMARY: 0,
  },
  URGENCY: {
    EMERGENCY: {
      TERTIARY_BONUS: 15,
      ICU_REQUIRED_BONUS: 15,
      TRAUMA_CARE_BONUS: 10,
      DISTANCE_KM_PENALTY_RATE: 0.35,
    },
    URGENT: {
      SECONDARY_OR_TERTIARY_BONUS: 10,
      DISTANCE_KM_PENALTY_RATE: 0.20,
    },
    ROUTINE: {
      LOCAL_PRIMARY_BONUS: 10,
      QUEUE_PENALTY_MULTIPLIER: 1.5,
      DISTANCE_KM_PENALTY_RATE: 0.15,
    },
  },
  QUEUE: {
    ZERO_WAIT_BONUS: 5,
    PER_WAITING_PENALTY: 4,
    MAX_QUEUE_PENALTY: 25,
  },
  DEFAULT_KM_PENALTY_RATE: 0.20,
  ESTIMATED_SPEED_KMH: 40,
  MIN_TRAVEL_TIME_MINS: 5,
  MIN_SCORE: 15,
  MAX_SCORE: 99,
};

/**
 * Pure, deterministic Haversine distance calculation in kilometers.
 * Throws on non-numeric or NaN coordinates.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== 'number' || isNaN(lat1) ||
    typeof lon1 !== 'number' || isNaN(lon1) ||
    typeof lat2 !== 'number' || isNaN(lat2) ||
    typeof lon2 !== 'number' || isNaN(lon2)
  ) {
    throw new Error('Invalid coordinates provided to haversineDistanceKm: all parameters must be valid numbers');
  }

  const R = 6371; // Earth's radius in kilometers
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const radLat1 = lat1 * toRad;
  const radLat2 = lat2 * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return Math.round(d * 10) / 10;
}

/**
 * Multi-Factor Capability-Aware Facility Routing Engine.
 * Evaluates real PostgreSQL data:
 * - Real Haversine distance from Facility.latitude/Facility.longitude
 * - Real services from FacilityService (case-insensitive)
 * - Real specialty from FacilityDoctor -> Doctor -> Specialist and FacilityService
 * - Real capacities across general, ICU, oxygen, maternity, NICU
 * - Real availability status (OPEN, OVERCAPACITY, CLOSED) and readinessScore
 * - Real live queue load from QueueEntry (WAITING, PRIORITY, IN_CONSULTATION)
 * - Urgency suitability (EMERGENCY, URGENT, ROUTINE)
 * - Zero DB mutations (READ-ONLY)
 */
export async function calculateOptimalRoutes(
  params: RouteRequest,
  prismaClient?: PrismaClient
): Promise<FacilityRouteResult[]> {
  const db = prismaClient || defaultPrisma;

  const requiredSpecialty = (params.requiredSpecialty || params.specialty || '').trim();
  const requiredService = (params.requiredService || '').trim();
  const urgency = (params.urgency || 'ROUTINE').toUpperCase().trim();
  const patientLocation = params.patientLocation;

  // 1. Fetch live facilities with services, capacities, availability, and doctors
  const facilities = await db.facility.findMany({
    include: {
      services: true,
      availability: true,
      capacities: true,
      doctors: {
        include: {
          doctor: {
            include: {
              specialist: true
            }
          }
        }
      }
    });
    }
  });

    // 2. Score them based on: Load (Queue length), Readiness, Distance (Mocked here), Specialty
    const scored = facilities.map(f => {
      let score = 100;
      
      // Load penalty
      const queueLength = 0; // Mocked for now since queue is not on Facility
      score -= (queueLength * 5); // Reduce score for high load
  // 2. Fetch live active queue entries to determine real operational load
  const activeQueueEntries = await db.queueEntry.findMany({
    where: {
      status: { in: ['WAITING', 'PRIORITY', 'IN_CONSULTATION'] }
    },
    select: {
      id: true,
      status: true,
      appointment: { select: { facilityId: true } },
      doctor: { select: { facilities: { select: { facilityId: true } } } }
    }
  });

      // Readiness factor
      if (f.availability?.readinessScore) {
        score += (f.availability.readinessScore - 50); // Boost or penalize based on ops readiness
  // Aggregate active queue counts per facility
  const facilityQueueMap: Record<string, number> = {};
  for (const entry of activeQueueEntries) {
    let facId = entry.appointment?.facilityId;
    if (!facId && entry.doctor?.facilities?.length) {
      facId = entry.doctor.facilities[0].facilityId;
    }
    if (facId) {
      facilityQueueMap[facId] = (facilityQueueMap[facId] || 0) + 1;
    }
  }

  // Check if valid patient coordinates were supplied
  const hasPatientCoords =
    patientLocation != null &&
    ((typeof patientLocation.latitude === 'number' && !isNaN(patientLocation.latitude)) ||
      (typeof patientLocation.lat === 'number' && !isNaN(patientLocation.lat))) &&
    ((typeof patientLocation.longitude === 'number' && !isNaN(patientLocation.longitude)) ||
      (typeof patientLocation.lng === 'number' && !isNaN(patientLocation.lng)) ||
      (typeof patientLocation.lon === 'number' && !isNaN(patientLocation.lon)));

  const pLat = hasPatientCoords
    ? typeof patientLocation!.latitude === 'number'
      ? patientLocation!.latitude
      : patientLocation!.lat!
    : null;

  const pLon = hasPatientCoords
    ? typeof patientLocation!.longitude === 'number'
      ? patientLocation!.longitude
      : (patientLocation!.lng ?? patientLocation!.lon!)
    : null;

  // 3. Score each facility
  const scoredFacilities = facilities.map((fac) => {
    let score = ROUTING_WEIGHTS.BASE_SCORE;
    const reasons: string[] = [];

    // --- FACTOR 1: READINESS SCORE ---
    const readiness = fac.availability?.readinessScore ?? 75;
    const readinessFactor = Math.round((readiness - 50) * ROUTING_WEIGHTS.READINESS_FACTOR);
    score += readinessFactor;

    // --- FACTOR 2: OPERATIONAL STATUS ---
    let availabilityScore = 0;
    const availStatus = fac.availability?.status?.toUpperCase() || 'OPEN';
    if (availStatus === 'OPEN') {
      availabilityScore = ROUTING_WEIGHTS.AVAILABILITY.OPEN;
      reasons.push('Facility operational & accepting referrals');
    } else if (availStatus === 'OVERCAPACITY') {
      availabilityScore = ROUTING_WEIGHTS.AVAILABILITY.OVERCAPACITY_PENALTY;
      reasons.push('High occupancy / operating over designated bed capacity');
    } else if (availStatus === 'CLOSED') {
      availabilityScore = ROUTING_WEIGHTS.AVAILABILITY.CLOSED_PENALTY;
      reasons.push('Facility currently closed for non-emergency intake');
    }
    score += availabilityScore;

    // --- FACTOR 3: CAPACITIES ---
    let genTotal = 0, genOcc = 0;
    let icuTotal = 0, icuOcc = 0;
    let oxyTotal = 0, oxyOcc = 0;
    let matTotal = 0, matOcc = 0;
    let nicuTotal = 0, nicuOcc = 0;

    for (const c of fac.capacities) {
      const resLower = c.resource.toLowerCase();
      const total = Math.max(0, c.total);
      const occupied = Math.max(0, Math.min(total, c.occupied));

      if (resLower.includes('icu') && !resLower.includes('nicu') && !resLower.includes('picu')) {
        icuTotal += total;
        icuOcc += occupied;
      } else if (resLower.includes('nicu') || resLower.includes('picu')) {
        nicuTotal += total;
        nicuOcc += occupied;
      } else if (resLower.includes('oxygen') || resLower.includes('concentrator')) {
        oxyTotal += total;
        oxyOcc += occupied;
      } else if (resLower.includes('matern') || resLower.includes('delivery') || resLower.includes('labor')) {
        matTotal += total;
        matOcc += occupied;
      } else if (resLower.includes('general') || resLower.includes('ward') || resLower.includes('observation')) {
        genTotal += total;
        genOcc += occupied;
      }
    }

      // Hard filter for specialty
      let hasSpecialty = true;
      if (requiredSpecialty) {
        hasSpecialty = f.services.some((s: any) => s.service.toLowerCase().includes(requiredSpecialty.toLowerCase()));
    const icuAvail = Math.max(0, icuTotal - icuOcc);
    const oxyAvail = Math.max(0, oxyTotal - oxyOcc);
    const genAvail = Math.max(0, genTotal - genOcc);
    const matAvail = Math.max(0, matTotal - matOcc);
    const nicuAvail = Math.max(0, nicuTotal - nicuOcc);

    const totalBeds = genTotal + icuTotal + oxyTotal + matTotal + nicuTotal;
    const totalOccupied = genOcc + icuOcc + oxyOcc + matOcc + nicuOcc;
    const totalAvailable = totalBeds - totalOccupied;

    let capacityScore = 0;

    if (icuAvail > 0) {
      capacityScore += ROUTING_WEIGHTS.CAPACITY.ICU_BED_AVAILABLE_BOOST;
      reasons.push(`${icuAvail} ICU beds available`);
    }

    if (oxyAvail > 0) {
      capacityScore += ROUTING_WEIGHTS.CAPACITY.OXYGEN_BED_AVAILABLE_BOOST;
      reasons.push(`${oxyAvail} Oxygen support beds available`);
    }

    if (genAvail > 0) {
      capacityScore += ROUTING_WEIGHTS.CAPACITY.GENERAL_BED_AVAILABLE_BOOST;
    }

    if (matAvail > 0) {
      capacityScore += ROUTING_WEIGHTS.CAPACITY.MATERNITY_BED_AVAILABLE_BOOST;
    }

    if (nicuAvail > 0) {
      capacityScore += ROUTING_WEIGHTS.CAPACITY.NICU_BED_AVAILABLE_BOOST;
      reasons.push(`${nicuAvail} NICU/PICU beds available`);
    }

    if (totalBeds > 0 && totalAvailable === 0) {
      capacityScore += ROUTING_WEIGHTS.CAPACITY.ALL_CAPACITY_EXHAUSTED_PENALTY;
      reasons.push('All facility beds fully occupied');
    }

    score += capacityScore;

    // --- FACTOR 4: REQUIRED SERVICE MATCHING ---
    let serviceMatchScore = 0;
    if (requiredService) {
      const reqLower = requiredService.toLowerCase();
      const matchedService = fac.services.find(
        (s) => s.isAvailable !== false && s.service.toLowerCase().includes(reqLower)
      );
      if (matchedService) {
        serviceMatchScore = ROUTING_WEIGHTS.SERVICE_MATCH_BOOST;
        reasons.push(`Required service available: ${matchedService.service}`);
      } else {
        reasons.push(`Required service unavailable: ${requiredService}`);
      }
    }
    score += serviceMatchScore;

      return {
        facilityId: f.id,
        name: f.name,
        type: f.type,
        score,
        queueLength,
        isEligible: hasSpecialty && (f.availability?.status === 'ACTIVE' || !f.availability)
      };
    // --- FACTOR 5: SPECIALTY AVAILABILITY ---
    let specialtyMatchScore = 0;
    if (requiredSpecialty) {
      const specLower = requiredSpecialty.toLowerCase();
      // Physical specialist assigned to facility
      const matchedDoctorSpecialist = fac.doctors.find((fd) => {
        const docSpec = fd.doctor?.specialist?.specialty?.toLowerCase();
        return docSpec && (docSpec.includes(specLower) || specLower.includes(docSpec));
      });

      // Specialty clinical service in facility
      const matchedServiceSpecialty = fac.services.find(
        (s) => s.isAvailable !== false && s.service.toLowerCase().includes(specLower)
      );

      if (matchedDoctorSpecialist) {
        specialtyMatchScore = ROUTING_WEIGHTS.SPECIALTY_ON_SITE_DOCTOR_BOOST;
        reasons.push(
          `Specialist on-site: ${matchedDoctorSpecialist.doctor.specialist!.specialty}`
        );
      } else if (matchedServiceSpecialty) {
        specialtyMatchScore = ROUTING_WEIGHTS.SPECIALTY_SERVICE_BOOST;
        reasons.push(`Specialty clinical service: ${matchedServiceSpecialty.service}`);
      }
    }
    score += specialtyMatchScore;

    // --- FACTOR 6: FACILITY LEVEL / TIER ---
    let levelBoost = 0;
    if (fac.level === 3) {
      levelBoost = ROUTING_WEIGHTS.LEVEL_BOOST.LEVEL_3_TERTIARY;
      reasons.push('Tertiary multi-specialty capability');
    } else if (fac.level === 2) {
      levelBoost = ROUTING_WEIGHTS.LEVEL_BOOST.LEVEL_2_SECONDARY;
      reasons.push('Secondary care & emergency observation');
    } else {
      levelBoost = ROUTING_WEIGHTS.LEVEL_BOOST.LEVEL_1_PRIMARY;
    }

    // --- FACTOR 7: URGENCY SUITABILITY ---
    let urgencyBonus = 0;
    if (urgency === 'EMERGENCY') {
      if (fac.level === 3) {
        urgencyBonus += ROUTING_WEIGHTS.URGENCY.EMERGENCY.TERTIARY_BONUS;
      }
      if (icuAvail > 0) {
        urgencyBonus += ROUTING_WEIGHTS.URGENCY.EMERGENCY.ICU_REQUIRED_BONUS;
      }
      const hasTrauma = fac.services.some((s) => {
        const sl = s.service.toLowerCase();
        return sl.includes('trauma') || sl.includes('emergency');
      });
      if (hasTrauma) {
        urgencyBonus += ROUTING_WEIGHTS.URGENCY.EMERGENCY.TRAUMA_CARE_BONUS;
      }
    } else if (urgency === 'URGENT') {
      if (fac.level >= 2) {
        urgencyBonus += ROUTING_WEIGHTS.URGENCY.URGENT.SECONDARY_OR_TERTIARY_BONUS;
      }
    } else {
      // ROUTINE
      if (fac.level <= 2) {
        urgencyBonus += ROUTING_WEIGHTS.URGENCY.ROUTINE.LOCAL_PRIMARY_BONUS;
      }
    }

    score += levelBoost + urgencyBonus;

    // --- FACTOR 8: DISTANCE (HAVERSINE) ---
    let distance_km: number | null = null;
    let estimated_travel_time_minutes: number | null = null;
    let distancePenalty = 0;

    if (hasPatientCoords && pLat != null && pLon != null && typeof fac.latitude === 'number' && typeof fac.longitude === 'number') {
      distance_km = haversineDistanceKm(pLat, pLon, fac.latitude, fac.longitude);
      estimated_travel_time_minutes = Math.max(
        ROUTING_WEIGHTS.MIN_TRAVEL_TIME_MINS,
        Math.round((distance_km / ROUTING_WEIGHTS.ESTIMATED_SPEED_KMH) * 60)
      );

      const kmRate =
        urgency === 'EMERGENCY'
          ? ROUTING_WEIGHTS.URGENCY.EMERGENCY.DISTANCE_KM_PENALTY_RATE
          : urgency === 'URGENT'
          ? ROUTING_WEIGHTS.URGENCY.URGENT.DISTANCE_KM_PENALTY_RATE
          : ROUTING_WEIGHTS.URGENCY.ROUTINE.DISTANCE_KM_PENALTY_RATE;

      distancePenalty = Math.round(distance_km * kmRate);
      reasons.push(`~${distance_km} km away (~${estimated_travel_time_minutes} mins travel)`);
    } else {
      distance_km = null;
      estimated_travel_time_minutes = null;
      distancePenalty = 0;
    }

    score -= distancePenalty;

    // --- FACTOR 9: LIVE QUEUE LOAD ---
    const activeQueueCount = facilityQueueMap[fac.id] || 0;
    let queuePenalty = 0;

    if (activeQueueCount === 0) {
      queuePenalty = -ROUTING_WEIGHTS.QUEUE.ZERO_WAIT_BONUS; // Negative penalty is a bonus
      reasons.push('Minimal queue delay (0 waiting)');
    } else {
      const queueMultiplier =
        urgency === 'ROUTINE' ? ROUTING_WEIGHTS.URGENCY.ROUTINE.QUEUE_PENALTY_MULTIPLIER : 1.0;
      queuePenalty = Math.min(
        ROUTING_WEIGHTS.QUEUE.MAX_QUEUE_PENALTY,
        Math.round(activeQueueCount * ROUTING_WEIGHTS.QUEUE.PER_WAITING_PENALTY * queueMultiplier)
      );
      reasons.push(`Active queue load (${activeQueueCount} patients awaiting care)`);
    }

    score -= queuePenalty;

    // Final bounded score
    const finalScore = Math.min(
      ROUTING_WEIGHTS.MAX_SCORE,
      Math.max(ROUTING_WEIGHTS.MIN_SCORE, Math.round(score))
    );

    const factors: RoutingFactors = {
      base_score: ROUTING_WEIGHTS.BASE_SCORE,
      readiness: readinessFactor,
      availability: availabilityScore,
      service_match: serviceMatchScore,
      specialty_match: specialtyMatchScore,
      capacity: capacityScore,
      urgency_suitability: levelBoost + urgencyBonus,
      queue_penalty: -queuePenalty,
      distance_penalty: -distancePenalty,
    };

    return {
      facility_id: fac.id,
      facility_name: fac.name,
      type: fac.type,
      level: fac.level,
      distance_km,
      estimated_travel_time_minutes,
      score: finalScore,
      readiness_score: readiness,
      is_alternative: false,
      freshness_penalty_applied: false,
      reasons: reasons.slice(0, 4),
      factors,
      active_queue_count: activeQueueCount,
      capacities_summary: {
        general_beds: { total: genTotal, occupied: genOcc, available: genAvail },
        icu_beds: { total: icuTotal, occupied: icuOcc, available: icuAvail },
        oxygen_beds: { total: oxyTotal, occupied: oxyOcc, available: oxyAvail },
        maternity_beds: { total: matTotal, occupied: matOcc, available: matAvail },
        nicu_beds: { total: nicuTotal, occupied: nicuOcc, available: nicuAvail },
        total_beds: totalBeds,
        total_occupied: totalOccupied,
        total_available: totalAvailable,
      }
    };
  });

  // Sort descending by score
  scoredFacilities.sort((a, b) => b.score - a.score);

  // Mark alternative facilities (all except top candidate)
  return scoredFacilities.map((fac, idx) => ({
    ...fac,
    is_alternative: idx > 0,
  }));
}

/**
 * Backward-compatible helper for legacy routing consumers.
 * Uses the pure PostgreSQL multi-factor routing engine with zero mock data.
 */
export const getOptimalFacilities = async (
  patientLat: number,
  patientLon: number,
  requiredSpecialty?: string
) => {
  try {
    const results = await calculateOptimalRoutes({
      patientLocation: { latitude: patientLat, longitude: patientLon },
      requiredSpecialty,
      urgency: 'ROUTINE',
    });

    // Sort descending by score
    return scored.filter(s => s.isEligible).sort((a, b) => b.score - a.score);

    return results.map((f) => ({
      facilityId: f.facility_id,
      name: f.facility_name,
      type: f.type,
      score: f.score,
      queueLength: f.active_queue_count,
      isEligible: f.score > 20,
    }));
  } catch (error) {
    console.error('Routing Engine Error:', error);
    return [];
  }
};
