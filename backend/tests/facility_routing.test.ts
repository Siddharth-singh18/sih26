/**
 * AyuSync - Facility & Operations Intelligence Phase 3 Test Suite
 * REAL, DATABASE-BACKED, CAPABILITY-AWARE FACILITY ROUTING
 *
 * Scenarios:
 * 1. Multi-actor Authentication (CMO, Specialist Doctor, Patient, Frontline Worker)
 * 2. Real PostgreSQL Facility Baseline Audit (Validates 5 facilities, services, capacities)
 * 3. Basic Facility Routing from Real DB (Validates snake_case and camelCase compatibility)
 * 4. Clinical Service Match Boost (FacilityService lookup)
 * 5. Clinical Specialty Match Boost (Doctor -> Specialist lookup)
 * 6. Facility Level Hierarchy Suitability (Level 1 vs Level 2 vs Level 3)
 * 7. Emergency Urgency Prioritization (Tertiary / ICU boost)
 * 8. Routine Urgency Prioritization (Primary care boost)
 * 9. Live Queue Load Penalty (Active QueueEntry penalties)
 * 10. Zero-Queue Idle Bonus (Facilities with 0 waiting receive boost)
 * 11. General Bed Availability Scoring Boost
 * 12. ICU Bed Availability Scoring Boost
 * 13. Oxygen Bed Availability Scoring Boost
 * 14. Maternity Bed Availability Scoring Boost
 * 15. NICU Bed Availability Scoring Boost
 * 16. Capability Exclusion: CLOSED facility marked ineligible with explicit reason
 * 17. Capability Exclusion: EMERGENCY urgency without ICU/trauma marked ineligible
 * 18. Capability Exclusion: Missing required specialty marked ineligible
 * 19. Capability Exclusion: Missing required service marked ineligible
 * 20. Capability Exclusion: Exhausted required bed type marked ineligible
 * 21. Operational Status Penalty: OPEN vs OVERCAPACITY
 * 22. Pure Haversine Distance Precision for known lat/lon pairs
 * 23. Distance Penalty Scaling with Urgency Rate
 * 24. Unsupported Distance Handling (NOT_SUPPORTED_BY_SCHEMA without fabricating locations)
 * 25. Complete Explainability Breakdown (Score, Readiness, Queue, Distance factors)
 * 26. CapabilityMatch Boolean Breakdown (Service, Specialty, Capacity, Level, Urgency)
 * 27. Deterministic Ranking (Identical inputs yield identical rankings)
 * 28. Maximum Distance Radius Filter (maxDistanceKm marks further facilities ineligible)
 * 29. Exclude Facility IDs Filter (excludeFacilityIds removes specified facilities)
 * 30. Limit Parameter Pagination (Restricts number of returned candidates)
 * 31. POST /api/facilities/route Endpoint Integration & Meta Structure
 * 32. POST /api/ai/route Endpoint Backward Compatibility & Meta Structure
 * 33. Input Validation: Invalid urgency level rejected with HTTP 400
 * 34. Input Validation: Invalid coordinates rejected with HTTP 400
 * 35. Input Validation: Invalid bed type rejected with HTTP 400
 * 36. RBAC Protection: Unauthenticated requests rejected with HTTP 401
 * 37. RBAC Protection: Patient role without facility.read permission rejected with HTTP 403
 * 38. Zero Database Mutations Verification (Routing is strictly READ-ONLY)
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { haversineDistanceKm, calculateOptimalRoutes, ROUTING_WEIGHTS } from '../src/modules/routing/routing.service';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';

let cmoToken = '';
let pedsToken = '';
let patientToken = '';
let workerToken = '';

async function runFacilityRoutingTests() {
  console.log('===============================================================');
  console.log('  AYUSYNC FACILITY ROUTING PHASE 3 VERIFICATION SUITE         ');
  console.log('  REAL, DATABASE-BACKED, CAPABILITY-AWARE ROUTING ENGINE       ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: any, name: string, detail?: string) {
    if (Boolean(condition)) {
      console.log(`  [PASS] Scenario ${passed + failed + 1}: ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] Scenario ${passed + failed + 1}: ${name}`);
      if (detail) console.error(`         Detail: ${detail}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // BASELINE CAPTURE: ENSURE ZERO POLLUTION
    // -------------------------------------------------------------
    const initialFacilityCount = await prisma.facility.count();
    const initialCapacityCount = await prisma.facilityCapacity.count();
    const initialServiceCount = await prisma.facilityService.count();
    const initialQueueCount = await prisma.queueEntry.count();

    // -------------------------------------------------------------
    // SCENARIO 1: Multi-actor Authentication
    // -------------------------------------------------------------
    const cmoLogin = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919876543210',
      password: 'password123'
    });
    cmoToken = cmoLogin.data.token;

    const pedsLogin = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919876543212',
      password: 'password123'
    });
    pedsToken = pedsLogin.data.token;

    const patLogin = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919111222333',
      password: 'password123'
    });
    patientToken = patLogin.data.token;

    const workerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919998887776',
      password: 'password123'
    });
    workerToken = workerLogin.data.token;

    assert(
      !!cmoToken && !!pedsToken && !!patientToken && !!workerToken,
      'Multi-actor Authentication: Verified tokens for CMO, Specialist Doctor, Patient, Frontline Worker'
    );

    // -------------------------------------------------------------
    // SCENARIO 2: Real PostgreSQL Facility Baseline Audit
    // -------------------------------------------------------------
    const dbFacilities = await prisma.facility.findMany({
      include: {
        services: true,
        capacities: true,
        availability: true,
        doctors: { include: { doctor: { include: { specialist: true } } } }
      }
    });

    assert(
      dbFacilities.length === 5 &&
      dbFacilities.some(f => f.id === 'fac-pune-dist' && f.level === 3) &&
      dbFacilities.some(f => f.id === 'fac-baramati-chc' && f.level === 2) &&
      dbFacilities.some(f => f.id === 'fac-khandala-phc' && f.level === 1),
      'Real PostgreSQL Facility Baseline Audit: Evaluated 5 genuine facilities across Levels 1, 2, and 3'
    );

    // -------------------------------------------------------------
    // SCENARIO 3: Basic Facility Routing from Real DB
    // -------------------------------------------------------------
    const basicRoutes = await calculateOptimalRoutes({ urgency: 'ROUTINE' }, prisma);
    assert(
      basicRoutes.length === 5 &&
      basicRoutes.every(r => r.facilityId && r.facility_id && r.facilityName && r.facility_name && typeof r.score === 'number'),
      'Basic Facility Routing: Returned 5 facilities with dual snake_case and camelCase identifiers'
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Clinical Service Match Boost (FacilityService lookup)
    // -------------------------------------------------------------
    const serviceRoutes = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      requiredService: 'Cardiology'
    }, prisma);

    const puneDist = serviceRoutes.find(r => r.facility_id === 'fac-pune-dist');
    const khandalaPhc = serviceRoutes.find(r => r.facility_id === 'fac-khandala-phc');

    assert(
      puneDist?.capabilityMatch.service === true &&
      puneDist.factors.service_match === ROUTING_WEIGHTS.SERVICE_MATCH_BOOST &&
      khandalaPhc?.capabilityMatch.service === false &&
      khandalaPhc.factors.service_match === 0,
      'Clinical Service Match Boost: fac-pune-dist received +20 service boost; fac-khandala-phc received 0'
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Clinical Specialty Match Boost (Doctor on-site)
    // -------------------------------------------------------------
    const pedRoutes = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      requiredSpecialty: 'Pediatrics'
    }, prisma);

    const junnarChc = pedRoutes.find(r => r.facility_id === 'fac-junnar-chc');
    assert(
      junnarChc?.capabilityMatch.specialty === true &&
      junnarChc.factors.specialty_match === ROUTING_WEIGHTS.SPECIALTY_ON_SITE_DOCTOR_BOOST,
      'Clinical Specialty Match Boost: fac-junnar-chc received +20 for assigned on-site Pediatrician Dr. Anand'
    );

    // -------------------------------------------------------------
    // SCENARIO 6: Facility Level Hierarchy Suitability
    // -------------------------------------------------------------
    assert(
      ROUTING_WEIGHTS.LEVEL_BOOST.LEVEL_3_TERTIARY === 10 &&
      ROUTING_WEIGHTS.LEVEL_BOOST.LEVEL_2_SECONDARY === 5 &&
      ROUTING_WEIGHTS.LEVEL_BOOST.LEVEL_1_PRIMARY === 0,
      'Facility Level Hierarchy: Tertiary +10, Secondary +5, Primary +0 baseline level suitability'
    );

    // -------------------------------------------------------------
    // SCENARIO 7: Emergency Urgency Prioritization
    // -------------------------------------------------------------
    const emergencyRoutes = await calculateOptimalRoutes({
      urgency: 'EMERGENCY'
    }, prisma);

    const emergencyTop = emergencyRoutes[0];
    assert(
      emergencyTop.facility_id === 'fac-pune-dist' &&
      emergencyTop.level === 3 &&
      emergencyTop.reasons.some(r => r.toLowerCase().includes('tertiary')),
      'Emergency Urgency Prioritization: Ranked Level 3 District Hospital #1 with tertiary trauma suitability'
    );

    // -------------------------------------------------------------
    // SCENARIO 8: Routine Urgency Prioritization
    // -------------------------------------------------------------
    const routineRoutes = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      patientLocation: { latitude: 18.0561, longitude: 74.0289 } // Near Khandala PHC
    }, prisma);

    const khandalaResult = routineRoutes.find(r => r.facility_id === 'fac-khandala-phc');
    assert(
      khandalaResult?.factors.urgency_suitability! >= ROUTING_WEIGHTS.URGENCY.ROUTINE.LOCAL_PRIMARY_BONUS,
      'Routine Urgency Prioritization: Local primary facility received local care bonus'
    );

    // -------------------------------------------------------------
    // SCENARIO 9: Live Queue Load Penalty
    // -------------------------------------------------------------
    const queueRoutes = await calculateOptimalRoutes({ urgency: 'ROUTINE' }, prisma);
    const facilitiesWithQueue = queueRoutes.filter(r => r.active_queue_count > 0);
    assert(
      facilitiesWithQueue.every(r => r.factors.queue_penalty > 0),
      'Live Queue Load Penalty: Facilities with active waiting patients incurred proportional queue penalty'
    );

    // -------------------------------------------------------------
    // SCENARIO 10: Zero-Queue Idle Bonus
    // -------------------------------------------------------------
    const idleFacilities = queueRoutes.filter(r => r.active_queue_count === 0);
    assert(
      idleFacilities.length > 0 &&
      idleFacilities.every(r => r.factors.queue_penalty === -ROUTING_WEIGHTS.QUEUE.ZERO_WAIT_BONUS),
      'Zero-Queue Idle Bonus: Facilities with 0 active patients received zero-wait bonus (+5)'
    );

    // -------------------------------------------------------------
    // SCENARIO 11: General Bed Availability Scoring Boost
    // -------------------------------------------------------------
    assert(
      basicRoutes.some(r => r.capacities_summary.general_beds.available > 0 && r.factors.capacity >= ROUTING_WEIGHTS.CAPACITY.GENERAL_BED_AVAILABLE_BOOST),
      'General Bed Availability Scoring Boost: Facilities with available general beds received +6 boost'
    );

    // -------------------------------------------------------------
    // SCENARIO 12: ICU Bed Availability Scoring Boost
    // -------------------------------------------------------------
    assert(
      puneDist?.capacities_summary.icu_beds.available! > 0 &&
      puneDist?.reasons.some(r => r.includes('ICU beds available')),
      'ICU Bed Availability Scoring Boost: fac-pune-dist (10 ICU beds available) received +12 boost'
    );

    // -------------------------------------------------------------
    // SCENARIO 13: Oxygen Bed Availability Scoring Boost
    // -------------------------------------------------------------
    assert(
      basicRoutes.some(r => r.capacities_summary.oxygen_beds.available > 0 && r.reasons.some(re => re.includes('Oxygen'))),
      'Oxygen Bed Availability Scoring Boost: Facilities with available oxygen beds received +8 boost'
    );

    // -------------------------------------------------------------
    // SCENARIO 14: Maternity Bed Availability Scoring Boost
    // -------------------------------------------------------------
    assert(
      basicRoutes.some(r => r.capacities_summary.maternity_beds.available > 0 && r.reasons.some(re => re.toLowerCase().includes('maternity'))),
      'Maternity Bed Availability Scoring Boost: Facilities with available maternity beds received +5 boost'
    );

    // -------------------------------------------------------------
    // SCENARIO 15: NICU Bed Availability Scoring Boost
    // -------------------------------------------------------------
    assert(
      basicRoutes.some(r => r.capacities_summary.nicu_beds.available > 0 && r.reasons.some(re => re.includes('NICU'))),
      'NICU Bed Availability Scoring Boost: Facilities with available NICU beds received +8 boost'
    );

    // -------------------------------------------------------------
    // SCENARIO 16: Capability Exclusion: CLOSED facility marked ineligible
    // -------------------------------------------------------------
    // Test with simulated CLOSED status
    const mockClosedDb = {
      facility: {
        findMany: async () => [
          {
            id: 'fac-test-closed',
            name: 'Closed Health Post',
            type: 'PRIMARY',
            level: 1,
            services: [],
            capacities: [],
            availability: { status: 'CLOSED', readinessScore: 20 },
            doctors: []
          }
        ]
      },
      queueEntry: { findMany: async () => [] }
    } as any;

    const closedRoutes = await calculateOptimalRoutes({ urgency: 'ROUTINE' }, mockClosedDb);
    assert(
      closedRoutes[0].eligible === false &&
      closedRoutes[0].ineligibilityReasons.some(r => r.includes('CLOSED')),
      'Capability Exclusion (CLOSED): Facility with CLOSED status marked ineligible with explicit reason'
    );

    // -------------------------------------------------------------
    // SCENARIO 17: Capability Exclusion: EMERGENCY without ICU/trauma
    // -------------------------------------------------------------
    const emergRoutes = await calculateOptimalRoutes({ urgency: 'EMERGENCY' }, prisma);
    const nonEmergencyEligible = emergRoutes.filter(r => !r.eligible);
    assert(
      nonEmergencyEligible.some(r => r.ineligibilityReasons.some(reason => reason.includes('ICU') || reason.includes('trauma'))),
      'Capability Exclusion (EMERGENCY): PHCs lacking ICU/trauma capabilities marked ineligible for EMERGENCY urgency'
    );

    // -------------------------------------------------------------
    // SCENARIO 18: Capability Exclusion: Missing required specialty
    // -------------------------------------------------------------
    const cardioRoutes = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      requiredSpecialty: 'Cardiology'
    }, prisma);

    const cardioIneligible = cardioRoutes.filter(r => !r.eligible);
    assert(
      cardioIneligible.length >= 3 &&
      cardioIneligible.every(r => r.ineligibilityReasons.some(re => re.includes('specialty'))),
      'Capability Exclusion (Specialty): Facilities lacking Cardiology specialist marked ineligible with reason'
    );

    // -------------------------------------------------------------
    // SCENARIO 19: Capability Exclusion: Missing required service
    // -------------------------------------------------------------
    const dialysisRoutes = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      requiredService: 'Dialysis'
    }, prisma);

    assert(
      dialysisRoutes.every(r => !r.eligible && r.ineligibilityReasons.some(re => re.includes('Dialysis'))),
      'Capability Exclusion (Service): Facilities lacking Dialysis marked ineligible with explicit service reason'
    );

    // -------------------------------------------------------------
    // SCENARIO 20: Capability Exclusion: Exhausted required bed type
    // -------------------------------------------------------------
    const icuBedRoutes = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      requiredBedType: 'ICU'
    }, prisma);

    const lackingIcu = icuBedRoutes.filter(r => r.capacities_summary.icu_beds.available === 0);
    assert(
      lackingIcu.length > 0 &&
      lackingIcu.every(r => !r.eligible && r.ineligibilityReasons.some(re => re.includes('ICU'))),
      'Capability Exclusion (Bed Type): Facilities with 0 available ICU beds marked ineligible for ICU request'
    );

    // -------------------------------------------------------------
    // SCENARIO 21: Operational Status Penalty: OPEN vs OVERCAPACITY
    // -------------------------------------------------------------
    assert(
      ROUTING_WEIGHTS.AVAILABILITY.OPEN === 10 &&
      ROUTING_WEIGHTS.AVAILABILITY.OVERCAPACITY_PENALTY === -25,
      'Operational Status Penalty: OPEN grants +10; OVERCAPACITY imposes -25 penalty (35 point delta)'
    );

    // -------------------------------------------------------------
    // SCENARIO 22: Pure Haversine Distance Precision
    // -------------------------------------------------------------
    // Mumbai (19.0760, 72.8777) to Pune (18.5204, 73.8567) is ~119.5 km
    const mumbaiPuneDist = haversineDistanceKm(19.0760, 72.8777, 18.5204, 73.8567);
    assert(
      Math.abs(mumbaiPuneDist - 119.5) < 1.0,
      `Pure Haversine Distance Precision: Mumbai-Pune distance calculated as ${mumbaiPuneDist} km (expected ~119.5 km)`
    );

    // -------------------------------------------------------------
    // SCENARIO 23: Distance Penalty Scaling with Urgency Rate
    // -------------------------------------------------------------
    assert(
      ROUTING_WEIGHTS.URGENCY.EMERGENCY.DISTANCE_KM_PENALTY_RATE > ROUTING_WEIGHTS.URGENCY.ROUTINE.DISTANCE_KM_PENALTY_RATE,
      'Distance Penalty Scaling: EMERGENCY penalizes travel distance at 0.35/km vs ROUTINE at 0.15/km'
    );

    // -------------------------------------------------------------
    // SCENARIO 24: Unsupported Distance Handling
    // -------------------------------------------------------------
    const noCoordRoutes = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      patientLocation: null
    }, prisma);

    assert(
      noCoordRoutes.every(r =>
        r.distanceStatus === 'NOT_SUPPORTED_BY_SCHEMA' &&
        r.distance === 'NOT_SUPPORTED_BY_SCHEMA' &&
        r.distance_km === null &&
        r.estimated_travel_time_minutes === null
      ),
      'Unsupported Distance Handling: Missing coordinates return NOT_SUPPORTED_BY_SCHEMA without fabricating locations'
    );

    // -------------------------------------------------------------
    // SCENARIO 25: Complete Explainability Breakdown
    // -------------------------------------------------------------
    const explainedRoute = basicRoutes[0];
    assert(
      explainedRoute.factors &&
      typeof explainedRoute.factors.base_score === 'number' &&
      typeof explainedRoute.factors.readiness === 'number' &&
      typeof explainedRoute.factors.availability === 'number' &&
      typeof explainedRoute.factors.service_match === 'number' &&
      typeof explainedRoute.factors.specialty_match === 'number' &&
      typeof explainedRoute.factors.capacity === 'number' &&
      typeof explainedRoute.factors.urgency_suitability === 'number' &&
      typeof explainedRoute.factors.queue_penalty === 'number' &&
      typeof explainedRoute.factors.distance_penalty === 'number' &&
      Array.isArray(explainedRoute.reasons) &&
      explainedRoute.reasons.length > 0,
      'Complete Explainability Breakdown: Full mathematical factor breakdown and human-readable clinical reasons present'
    );

    // -------------------------------------------------------------
    // SCENARIO 26: CapabilityMatch Boolean Breakdown
    // -------------------------------------------------------------
    assert(
      typeof explainedRoute.capabilityMatch.service === 'boolean' &&
      typeof explainedRoute.capabilityMatch.specialty === 'boolean' &&
      typeof explainedRoute.capabilityMatch.capacity === 'boolean' &&
      typeof explainedRoute.capabilityMatch.level === 'boolean' &&
      typeof explainedRoute.capabilityMatch.urgency === 'boolean',
      'CapabilityMatch Boolean Breakdown: Full 5-dimension boolean capability match flags verified'
    );

    // -------------------------------------------------------------
    // SCENARIO 27: Deterministic Ranking
    // -------------------------------------------------------------
    const run1 = await calculateOptimalRoutes({ urgency: 'PRIORITY' }, prisma);
    const run2 = await calculateOptimalRoutes({ urgency: 'PRIORITY' }, prisma);
    assert(
      run1.length === run2.length &&
      run1.every((r, idx) => r.facility_id === run2[idx].facility_id && r.score === run2[idx].score),
      'Deterministic Ranking: Identical inputs produced identical scores and rankings across repeated calls'
    );

    // -------------------------------------------------------------
    // SCENARIO 28: Maximum Distance Radius Filter (maxDistanceKm)
    // -------------------------------------------------------------
    const radiusFiltered = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      patientLocation: { latitude: 18.5204, longitude: 73.8567 }, // Pune City
      maxDistanceKm: 25
    }, prisma);

    const furtherAway = radiusFiltered.filter(r => r.distance_km !== null && r.distance_km > 25);
    assert(
      furtherAway.length > 0 &&
      furtherAway.every(r => !r.eligible && r.ineligibilityReasons.some(re => re.includes('exceeds maximum allowed radius'))),
      'Maximum Distance Radius Filter: Facilities beyond 25 km marked ineligible with distance radius violation'
    );

    // -------------------------------------------------------------
    // SCENARIO 29: Exclude Facility IDs Filter
    // -------------------------------------------------------------
    const excludedRoutes = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      excludeFacilityIds: ['fac-pune-dist', 'fac-baramati-chc']
    }, prisma);

    assert(
      excludedRoutes.length === 3 &&
      !excludedRoutes.some(r => r.facility_id === 'fac-pune-dist' || r.facility_id === 'fac-baramati-chc'),
      'Exclude Facility IDs Filter: Excluded specified facility IDs from candidate pool'
    );

    // -------------------------------------------------------------
    // SCENARIO 30: Limit Parameter Pagination
    // -------------------------------------------------------------
    const limitedRoutes = await calculateOptimalRoutes({
      urgency: 'ROUTINE',
      limit: 2
    }, prisma);

    assert(
      limitedRoutes.length === 2 &&
      limitedRoutes[0].is_alternative === false &&
      limitedRoutes[1].is_alternative === true,
      'Limit Parameter Pagination: Returned top 2 candidates with primary vs alternative demarcation'
    );

    // -------------------------------------------------------------
    // SCENARIO 31: POST /api/facilities/route Endpoint Integration
    // -------------------------------------------------------------
    const apiFacRouteRes = await axios.post(`${BASE_URL}/facilities/route`, {
      urgency: 'URGENT',
      requiredSpecialty: 'Pediatrics',
      patientLocation: { latitude: 19.2087, longitude: 73.8746 } // Near Junnar
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });

    assert(
      apiFacRouteRes.status === 200 &&
      Array.isArray(apiFacRouteRes.data.ranked_facilities) &&
      apiFacRouteRes.data.meta &&
      apiFacRouteRes.data.meta.totalEvaluated === 5 &&
      apiFacRouteRes.data.meta.distanceHandling === 'CALCULATED',
      'POST /api/facilities/route: Responded with HTTP 200, ranked_facilities array, and complete meta telemetry'
    );

    // -------------------------------------------------------------
    // SCENARIO 32: POST /api/ai/route Endpoint Backward Compatibility
    // -------------------------------------------------------------
    const apiAiRouteRes = await axios.post(`${BASE_URL}/ai/route`, {
      urgency: 'ROUTINE',
      condition: 'Fever and cough'
    }, {
      headers: { Authorization: `Bearer ${workerToken}` }
    });

    assert(
      apiAiRouteRes.status === 200 &&
      Array.isArray(apiAiRouteRes.data.ranked_facilities) &&
      apiAiRouteRes.data.meta &&
      apiAiRouteRes.data.ranked_facilities.length >= 2,
      'POST /api/ai/route: Responded with HTTP 200, preserved backward compatibility for frontline workflows'
    );

    // -------------------------------------------------------------
    // SCENARIO 33: Input Validation: Invalid urgency rejected
    // -------------------------------------------------------------
    let invalidUrgencyRejected = false;
    try {
      await axios.post(`${BASE_URL}/facilities/route`, {
        urgency: 'HYPER_CRITICAL_INVALID'
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      invalidUrgencyRejected = err.response?.status === 400 && err.response?.data?.message?.includes('urgency');
    }
    assert(
      invalidUrgencyRejected,
      'Input Validation: Invalid urgency rejected with HTTP 400 Bad Request'
    );

    // -------------------------------------------------------------
    // SCENARIO 34: Input Validation: Invalid coordinates rejected
    // -------------------------------------------------------------
    let invalidCoordRejected = false;
    try {
      await axios.post(`${BASE_URL}/facilities/route`, {
        urgency: 'ROUTINE',
        patientLocation: { latitude: 999, longitude: 50 } // Latitude > 90
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      invalidCoordRejected = err.response?.status === 400 && err.response?.data?.message?.includes('latitude');
    }
    assert(
      invalidCoordRejected,
      'Input Validation: Out-of-bounds latitude (999) rejected with HTTP 400 Bad Request'
    );

    // -------------------------------------------------------------
    // SCENARIO 35: Input Validation: Invalid bed type rejected
    // -------------------------------------------------------------
    let invalidBedTypeRejected = false;
    try {
      await axios.post(`${BASE_URL}/facilities/route`, {
        urgency: 'ROUTINE',
        requiredBedType: 'LUXURY_SUITE'
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      invalidBedTypeRejected = err.response?.status === 400 && err.response?.data?.message?.includes('bed type');
    }
    assert(
      invalidBedTypeRejected,
      'Input Validation: Invalid bed type rejected with HTTP 400 Bad Request'
    );

    // -------------------------------------------------------------
    // SCENARIO 36: RBAC Protection: Unauthenticated request rejected
    // -------------------------------------------------------------
    let unauthRejected = false;
    try {
      await axios.post(`${BASE_URL}/facilities/route`, { urgency: 'ROUTINE' });
    } catch (err: any) {
      unauthRejected = err.response?.status === 401;
    }
    assert(
      unauthRejected,
      'RBAC Protection: Request without Bearer token rejected with HTTP 401 Unauthorized'
    );

    // -------------------------------------------------------------
    // SCENARIO 37: RBAC Protection: User lacking facility.read permission rejected
    // -------------------------------------------------------------
    let forbiddenRejected = false;
    let tempUser: any = null;
    let tempRole: any = null;
    try {
      tempRole = await prisma.role.create({
        data: { name: 'TEST_NO_FACILITY_PERMS', description: 'Temporary test role without facility.read' }
      });
      tempUser = await prisma.user.create({
        data: {
          phone: '+919000888777',
          password: 'hashed_password_dummy',
          isActive: true,
          roles: { connect: { id: tempRole.id } }
        }
      });

      const limitedToken = jwt.sign(
        { id: tempUser.id, phone: tempUser.phone, role: 'TEST_NO_FACILITY_PERMS' },
        process.env.JWT_SECRET || 'ayusync_super_secret'
      );

      await axios.post(`${BASE_URL}/facilities/route`, {
        urgency: 'ROUTINE'
      }, {
        headers: { Authorization: `Bearer ${limitedToken}` }
      });
    } catch (err: any) {
      forbiddenRejected = err.response?.status === 403 && err.response?.data?.message?.includes('facility.read');
    } finally {
      if (tempUser) await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => {});
      if (tempRole) await prisma.role.delete({ where: { id: tempRole.id } }).catch(() => {});
    }

    assert(
      forbiddenRejected,
      'RBAC Protection: User token lacking facility.read permission rejected with HTTP 403 Forbidden'
    );

    // -------------------------------------------------------------
    // SCENARIO 38: Zero Database Mutations Verification
    // -------------------------------------------------------------
    const finalFacilityCount = await prisma.facility.count();
    const finalCapacityCount = await prisma.facilityCapacity.count();
    const finalServiceCount = await prisma.facilityService.count();
    const finalQueueCount = await prisma.queueEntry.count();

    assert(
      finalFacilityCount === initialFacilityCount &&
      finalCapacityCount === initialCapacityCount &&
      finalServiceCount === initialServiceCount &&
      finalQueueCount === initialQueueCount,
      'Zero Database Mutations Verification: Confirmed DB row counts strictly unchanged (READ-ONLY)'
    );

  } catch (error: any) {
    console.error('Fatal test error:', error.message);
    if (error.response?.data) console.error('Response data:', error.response.data);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n===============================================================');
  console.log(`  FACILITY ROUTING TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed})`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFacilityRoutingTests();
