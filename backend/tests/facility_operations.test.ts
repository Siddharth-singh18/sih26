/**
 * AyuSync - Facility & Operations Intelligence Phase 1 & 2 Test Suite
 * Validates:
 *
 * --- GROUP 1: FACILITY OWNERSHIP & SECURITY ENFORCEMENT ---
 * 1. Authenticate Actors (CMO Dr. Rajesh, Pediatrician Dr. Anand, Patient Ramesh, Worker Sunita)
 * 2. Authorized Doctor successfully updates own facility availability (HTTP 200)
 * 3. Cross-Facility IDOR Defense: Doctor B blocked from mutating Doctor A facility (HTTP 403)
 * 4. Unassigned Facility Defense: Doctor blocked from mutating facility with no assignment (HTTP 403)
 * 5. Role Boundary Defense: Patient blocked from facility availability mutation (HTTP 403)
 * 6. Role Boundary Defense: Frontline Worker blocked from facility availability mutation (HTTP 403)
 * 7. Non-existent facility ID safely returns HTTP 404
 * 8. State restoration: Facility availability successfully restored to original baseline
 *
 * --- GROUP 2: REAL POSTGRESQL CAPACITY MANAGEMENT & VALIDATION ---
 * 9. Authorized Doctor updates capacity on own facility (HTTP 200)
 * 10. PostgreSQL Persistence Audit: Authentic FacilityCapacity row verified directly in DB
 * 11. Facilities Telemetry Synchronization: GET /api/facilities reflects updated capacity
 * 12. Cross-Facility Capacity IDOR Defense: Unauthorized doctor blocked from capacity mutation (HTTP 403)
 * 13. Wrong Facility/Capacity ID Mismatch: Capacity belonging to another facility returns HTTP 404
 * 14. Non-existent Capacity ID returns HTTP 404
 * 15. Server-Side Input Validation: Negative total capacity rejected with HTTP 400
 * 16. Server-Side Input Validation: Negative occupied capacity rejected with HTTP 400
 * 17. Server-Side Input Validation: Floating-point non-integer capacity rejected with HTTP 400
 * 18. Logical Boundary Enforcement: Occupied exceeding total (occupied > total) rejected with HTTP 400
 * 19. Empty Payload Validation: Neither total nor occupied provided rejected with HTTP 400
 * 20. Audit Trail Verification: Mutation logged in PostgreSQL AuditLog table
 * 21. Clean State Restoration: Facility capacity restored to exact original baseline
 * 22. Zero DB Pollution Audit: Verified final DB state matches initial baseline
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';

let cmoToken = ''; // Dr. Rajesh Deshmukh (Assigned to fac-baramati-chc)
let pedsToken = ''; // Dr. Anand Joshi (Assigned to fac-junnar-chc)
let patientToken = ''; // Ramesh Kulkarni
let workerToken = ''; // Sunita Patil

// Baseline values for clean non-polluting test execution
let origBaramatiAvailability: any = null;
let origBaramatiCapacity: any = null;
const BARAMATI_FAC_ID = 'fac-baramati-chc';
const PUNE_DIST_FAC_ID = 'fac-pune-dist';
const SASWAD_FAC_ID = 'fac-saswad-phc';
let targetCapacityId = '';

async function runFacilityOperationsTests() {
  console.log('===============================================================');
  console.log('  AYUSYNC FACILITY OPERATIONS PHASE 1 & 2 VERIFICATION SUITE  ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
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
    // SETUP & BASELINE CAPTURE (GUARANTEES ZERO DB POLLUTION)
    // -------------------------------------------------------------
    console.log('--- SETUP: CAPTURING INITIAL DATABASE BASELINE ---');

    origBaramatiAvailability = await prisma.facilityAvailability.findUnique({
      where: { facilityId: BARAMATI_FAC_ID }
    });

    const baramatiCapacities = await prisma.facilityCapacity.findMany({
      where: { facilityId: BARAMATI_FAC_ID }
    });
    origBaramatiCapacity = baramatiCapacities.find(c => c.resource === 'General Ward Beds') || baramatiCapacities[0];
    targetCapacityId = origBaramatiCapacity.id;

    console.log(`  Baseline Availability for ${BARAMATI_FAC_ID}: status=${origBaramatiAvailability?.status}, score=${origBaramatiAvailability?.readinessScore}`);
    console.log(`  Baseline Capacity for ${origBaramatiCapacity.resource} (${targetCapacityId}): total=${origBaramatiCapacity.total}, occupied=${origBaramatiCapacity.occupied}`);

    // -------------------------------------------------------------
    // GROUP 1: FACILITY OWNERSHIP & SECURITY ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n--- GROUP 1: FACILITY OWNERSHIP & SECURITY ENFORCEMENT ---');

    // 1. Authenticate multi-actor cohort
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
      'Multi-Actor Authentication: Obtained tokens for CMO, Pediatrician, Patient, and Worker'
    );

    // 2. Authorized Doctor successfully updates own facility availability
    const authUpdateRes = await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/availability`, {
      status: 'OVERCAPACITY',
      readinessScore: 84
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    assert(
      authUpdateRes.status === 200 &&
      authUpdateRes.data.status === 'OVERCAPACITY' &&
      authUpdateRes.data.readinessScore === 84,
      'Authorized Doctor Access: Dr. Rajesh Deshmukh updates Baramati CHC availability to OVERCAPACITY'
    );

    // 3. Cross-Facility IDOR Defense: Doctor B blocked from mutating Doctor A facility
    let pedsBlocked = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/availability`, {
        status: 'OPEN',
        readinessScore: 90
      }, {
        headers: { Authorization: `Bearer ${pedsToken}` } // Dr. Anand Joshi (assigned only to Junnar)
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        pedsBlocked = true;
      }
    }
    assert(
      pedsBlocked,
      'Cross-Facility IDOR Defense: Dr. Anand Joshi blocked from mutating Baramati CHC (HTTP 403 Forbidden)'
    );

    // 4. Unassigned Facility Defense: Doctor blocked from mutating facility with no assignment
    let unassignedBlocked = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${SASWAD_FAC_ID}/availability`, {
        status: 'OPEN',
        readinessScore: 75
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` } // Dr. Rajesh is not assigned to Saswad PHC
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        unassignedBlocked = true;
      }
    }
    assert(
      unassignedBlocked,
      'Unassigned Facility Defense: Doctor blocked from mutating Saswad PHC where no FacilityDoctor relation exists (HTTP 403)'
    );

    // 5. Role Boundary Defense: Patient blocked from facility availability mutation
    let patientBlocked = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/availability`, {
        status: 'OPEN'
      }, {
        headers: { Authorization: `Bearer ${patientToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        patientBlocked = true;
      }
    }
    assert(
      patientBlocked,
      'Role Boundary Defense: Patient Ramesh Kulkarni denied facility availability mutation (HTTP 403 Forbidden)'
    );

    // 6. Role Boundary Defense: Frontline Worker blocked from facility availability mutation
    let workerBlocked = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/availability`, {
        status: 'OPEN'
      }, {
        headers: { Authorization: `Bearer ${workerToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        workerBlocked = true;
      }
    }
    assert(
      workerBlocked,
      'Role Boundary Defense: Frontline Worker Sunita Patil denied facility availability mutation (HTTP 403 Forbidden)'
    );

    // 7. Non-existent facility ID safely returns HTTP 404
    let notFoundCaught = false;
    try {
      await axios.put(`${BASE_URL}/facilities/fac-nonexistent-9999/availability`, {
        status: 'OPEN'
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 404) {
        notFoundCaught = true;
      }
    }
    assert(
      notFoundCaught,
      'Error Handling: Mutating non-existent facility ID returns HTTP 404 Not Found'
    );

    // 8. State restoration: Facility availability successfully restored to original baseline
    const restoreAvailRes = await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/availability`, {
      status: origBaramatiAvailability.status,
      readinessScore: origBaramatiAvailability.readinessScore
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    assert(
      restoreAvailRes.status === 200 &&
      restoreAvailRes.data.status === origBaramatiAvailability.status,
      'State Restoration: Baramati CHC availability restored cleanly to original DB baseline'
    );

    // -------------------------------------------------------------
    // GROUP 2: REAL POSTGRESQL CAPACITY MANAGEMENT & VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- GROUP 2: REAL POSTGRESQL CAPACITY MANAGEMENT & VALIDATION ---');

    // 9. Authorized Doctor updates capacity on own facility
    const testNewTotal = 65;
    const testNewOccupied = 40;
    const updateCapRes = await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/${targetCapacityId}`, {
      total: testNewTotal,
      occupied: testNewOccupied
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });

    assert(
      updateCapRes.status === 200 &&
      updateCapRes.data.total === testNewTotal &&
      updateCapRes.data.occupied === testNewOccupied,
      'Authorized Capacity Mutation: Dr. Rajesh Deshmukh updates Baramati CHC General Ward Beds (65 total, 40 occupied)'
    );

    // 10. PostgreSQL Persistence Audit: Authentic FacilityCapacity row verified directly in DB
    const dbCapRow = await prisma.facilityCapacity.findUnique({
      where: { id: targetCapacityId }
    });
    assert(
      dbCapRow !== null &&
      dbCapRow.total === testNewTotal &&
      dbCapRow.occupied === testNewOccupied,
      'PostgreSQL Persistence Audit: Direct database query confirms authentic persisted capacity row in PostgreSQL'
    );

    // 11. Facilities Telemetry Synchronization: GET /api/facilities reflects updated capacity
    const getFacsRes = await axios.get(`${BASE_URL}/facilities`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    const baramatiInList = getFacsRes.data.find((f: any) => f.id === BARAMATI_FAC_ID);
    const capInList = baramatiInList?.capacities?.find((c: any) => c.id === targetCapacityId);
    assert(
      capInList !== undefined &&
      capInList.total === testNewTotal &&
      capInList.occupied === testNewOccupied,
      'Telemetry Sync: GET /api/facilities immediately reflects newly persisted capacity values'
    );

    // 12. Cross-Facility Capacity IDOR Defense: Unauthorized doctor blocked from capacity mutation
    let pedsCapBlocked = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/${targetCapacityId}`, {
        occupied: 30
      }, {
        headers: { Authorization: `Bearer ${pedsToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        pedsCapBlocked = true;
      }
    }
    assert(
      pedsCapBlocked,
      'Cross-Facility Capacity Defense: Dr. Anand Joshi blocked from mutating Baramati CHC capacity (HTTP 403 Forbidden)'
    );

    // 13. Wrong Facility/Capacity ID Mismatch: Capacity belonging to another facility returns HTTP 404
    // Attempting to update Pune District Hospital capacity through Baramati facility URL
    const puneCaps = await prisma.facilityCapacity.findMany({ where: { facilityId: PUNE_DIST_FAC_ID } });
    const puneCapId = puneCaps[0]?.id;
    let mismatchCaught = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/${puneCapId}`, {
        occupied: 10
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 404) {
        mismatchCaught = true;
      }
    }
    assert(
      mismatchCaught,
      'Facility Scoping Defense: Capacity resource belonging to another facility returns HTTP 404 Not Found'
    );

    // 14. Non-existent Capacity ID returns HTTP 404
    let nonexistentCapCaught = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/cap-nonexistent-1234`, {
        occupied: 10
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 404) {
        nonexistentCapCaught = true;
      }
    }
    assert(
      nonexistentCapCaught,
      'Error Handling: Non-existent capacityId returns HTTP 404 Not Found'
    );

    // 15. Server-Side Input Validation: Negative total capacity rejected with HTTP 400
    let negativeTotalRejected = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/${targetCapacityId}`, {
        total: -10
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 400 && err.response.data?.message?.includes('negative')) {
        negativeTotalRejected = true;
      }
    }
    assert(
      negativeTotalRejected,
      'Input Validation: Negative total capacity (-10) rejected with HTTP 400 Bad Request'
    );

    // 16. Server-Side Input Validation: Negative occupied capacity rejected with HTTP 400
    let negativeOccupiedRejected = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/${targetCapacityId}`, {
        occupied: -5
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 400 && err.response.data?.message?.includes('negative')) {
        negativeOccupiedRejected = true;
      }
    }
    assert(
      negativeOccupiedRejected,
      'Input Validation: Negative occupied capacity (-5) rejected with HTTP 400 Bad Request'
    );

    // 17. Server-Side Input Validation: Floating-point non-integer capacity rejected with HTTP 400
    let nonIntegerRejected = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/${targetCapacityId}`, {
        total: 50.75
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 400 && err.response.data?.message?.includes('integer')) {
        nonIntegerRejected = true;
      }
    }
    assert(
      nonIntegerRejected,
      'Input Validation: Non-integer floating-point total capacity (50.75) rejected with HTTP 400'
    );

    // 18. Logical Boundary Enforcement: Occupied exceeding total rejected with HTTP 400
    let boundaryRejected = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/${targetCapacityId}`, {
        total: 50,
        occupied: 75 // Occupied > Total
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 400 && err.response.data?.message?.includes('cannot exceed')) {
        boundaryRejected = true;
      }
    }
    assert(
      boundaryRejected,
      'Logical Boundary Defense: Occupied beds (75) exceeding total beds (50) rejected with HTTP 400'
    );

    // 19. Empty Payload Validation: Neither total nor occupied provided rejected with HTTP 400
    let emptyPayloadRejected = false;
    try {
      await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/${targetCapacityId}`, {}, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 400) {
        emptyPayloadRejected = true;
      }
    }
    assert(
      emptyPayloadRejected,
      'Payload Validation: Empty mutation payload rejected with HTTP 400 Bad Request'
    );

    // 20. Audit Trail Verification: Mutation logged in PostgreSQL AuditLog table
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'UPDATE_CAPACITY',
        resource: 'FacilityCapacity',
        resourceId: targetCapacityId
      },
      orderBy: { timestamp: 'desc' },
      take: 1
    });
    assert(
      auditLogs.length > 0 &&
      auditLogs[0].action === 'UPDATE_CAPACITY',
      'Audit Trail Verification: Capacity mutation successfully appended to PostgreSQL AuditLog table'
    );

    // 21. Clean State Restoration: Facility capacity restored to exact original baseline
    const restoreCapRes = await axios.put(`${BASE_URL}/facilities/${BARAMATI_FAC_ID}/capacity/${targetCapacityId}`, {
      total: origBaramatiCapacity.total,
      occupied: origBaramatiCapacity.occupied
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    assert(
      restoreCapRes.status === 200 &&
      restoreCapRes.data.total === origBaramatiCapacity.total &&
      restoreCapRes.data.occupied === origBaramatiCapacity.occupied,
      'Clean State Restoration: Baramati General Ward Beds restored to original baseline (total=' + origBaramatiCapacity.total + ', occupied=' + origBaramatiCapacity.occupied + ')'
    );

    // 22. Zero DB Pollution Audit: Verified final DB state matches initial baseline
    const finalCapRow = await prisma.facilityCapacity.findUnique({
      where: { id: targetCapacityId }
    });
    const finalAvailRow = await prisma.facilityAvailability.findUnique({
      where: { facilityId: BARAMATI_FAC_ID }
    });
    assert(
      finalCapRow?.total === origBaramatiCapacity.total &&
      finalCapRow?.occupied === origBaramatiCapacity.occupied &&
      finalAvailRow?.status === origBaramatiAvailability.status,
      'Zero Database Pollution Audit: Direct DB query confirms zero permanent deviation from baseline'
    );

  } catch (err: any) {
    console.error('\nFatal test execution error:');
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error('Data:', err.response.data);
    } else {
      console.error(err.message);
    }
    failed++;
  } finally {
    // Failsafe DB baseline restoration if test aborted mid-flight
    try {
      if (origBaramatiCapacity && targetCapacityId) {
        await prisma.facilityCapacity.update({
          where: { id: targetCapacityId },
          data: {
            total: origBaramatiCapacity.total,
            occupied: origBaramatiCapacity.occupied
          }
        });
      }
      if (origBaramatiAvailability) {
        await prisma.facilityAvailability.update({
          where: { facilityId: BARAMATI_FAC_ID },
          data: {
            status: origBaramatiAvailability.status,
            readinessScore: origBaramatiAvailability.readinessScore
          }
        });
      }
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }
    await prisma.$disconnect();
  }

  console.log('\n===============================================================');
  console.log(`  FACILITY OPERATIONS PHASE 1 & 2 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFacilityOperationsTests();
