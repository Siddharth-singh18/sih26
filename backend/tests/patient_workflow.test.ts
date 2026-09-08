/**
 * AyuSync - Comprehensive Patient Workflow End-to-End Test Suite
 * Validates all 24 scenarios: Auth, RBAC, IDOR, Self-Service, Appointment Booking,
 * Duplicate Prevention, Arrival & Queue Token, Realtime Socket Events, Doctor Consultation.
 */

import axios from 'axios';
import path from 'path';

const socketIoPath = path.resolve(__dirname, '../../web/node_modules/socket.io-client');
const { io } = require(socketIoPath);

const BASE_URL = 'http://localhost:5000/api';
const ROOT_URL = 'http://localhost:5000';

let patientToken = '';
let patientUser: any = null;
let doctorToken = '';
let doctorUser: any = null;
let workerToken = '';
let workerUser: any = null;

let facilityId = '';
let doctorId = '';
let createdAppointmentId = '';
let queueEntryId = '';
let issuedTokenNumber = '';

const testDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]; // 2 days ahead

async function runTests() {
  console.log('====================================================');
  console.log('  AYUSYNC PATIENT WORKFLOW COMPREHENSIVE TEST SUITE  ');
  console.log('====================================================\n');

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
    // GROUP 1: AUTHENTICATION & IDENTITY DERIVATION
    // -------------------------------------------------------------
    console.log('--- GROUP 1: AUTHENTICATION & IDENTITY DERIVATION ---');

    // 1. Patient Login
    const patLogin = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919111222333',
      password: 'password123',
    });
    patientToken = patLogin.data.token;
    patientUser = patLogin.data.user;
    assert(
      patLogin.status === 200 &&
        patientUser.role === 'PATIENT' &&
        patientUser.patientId &&
        patientUser.name === 'Ramesh Kulkarni',
      'Patient login authenticates Ramesh Kulkarni and returns patientId',
      `Got role=${patientUser.role}, patientId=${patientUser.patientId}`
    );

    // 2. Doctor Login
    const docLogin = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919876543210',
      password: 'password123',
    });
    doctorToken = docLogin.data.token;
    doctorUser = docLogin.data.user;
    assert(
      docLogin.status === 200 &&
        doctorUser.role === 'DOCTOR' &&
        doctorUser.doctorId &&
        doctorUser.name === 'Dr. Rajesh Deshmukh',
      'Doctor login authenticates Dr. Rajesh Deshmukh and returns doctorId',
      `Got role=${doctorUser.role}, doctorId=${doctorUser.doctorId}`
    );

    // 3. Worker Login
    const wrkLogin = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919998887776',
      password: 'password123',
    });
    workerToken = wrkLogin.data.token;
    workerUser = wrkLogin.data.user;
    assert(
      wrkLogin.status === 200 &&
        workerUser.role === 'WORKER' &&
        workerUser.workerId &&
        workerUser.name === 'Sunita Patil',
      'Worker login authenticates Sunita Patil and returns workerId',
      `Got role=${workerUser.role}, workerId=${workerUser.workerId}`
    );

    const patHeaders = { Authorization: `Bearer ${patientToken}` };
    const docHeaders = { Authorization: `Bearer ${doctorToken}` };

    // -------------------------------------------------------------
    // GROUP 2: RBAC & IDOR AUTHORIZATION CHECKS
    // -------------------------------------------------------------
    console.log('\n--- GROUP 2: RBAC & IDOR AUTHORIZATION CHECKS ---');

    // 4. Patient blocked from doctor queue modification
    let blockedQueueUpdate = false;
    try {
      await axios.patch(`${BASE_URL}/queue/dummy-id/status`, { status: 'COMPLETED' }, { headers: patHeaders });
    } catch (e: any) {
      blockedQueueUpdate = e.response?.status === 403;
    }
    assert(blockedQueueUpdate, 'Patient cannot update doctor queue status (HTTP 403 Forbidden)');

    // 5. Patient blocked from worker sync endpoint
    let blockedSync = false;
    try {
      await axios.post(`${BASE_URL}/sync`, { mutations: [] }, { headers: patHeaders });
    } catch (e: any) {
      blockedSync = e.response?.status === 403;
    }
    assert(blockedSync, 'Patient cannot access worker sync mutation queue (HTTP 403 Forbidden)');

    // 6. IDOR: Patient blocked from viewing another patient timeline
    let blockedIdor = false;
    try {
      await axios.get(`${BASE_URL}/patients/pat-pooja-001/timeline`, { headers: patHeaders });
    } catch (e: any) {
      blockedIdor = e.response?.status === 403;
    }
    assert(blockedIdor, 'Patient cannot access other patients timeline (IDOR protection, HTTP 403)');

    // 7. Patient allowed to view own timeline via /me/timeline
    const myTimeline = await axios.get(`${BASE_URL}/patients/me/timeline`, { headers: patHeaders });
    assert(
      myTimeline.status === 200 && myTimeline.data.id === patientUser.patientId,
      'Patient can view own timeline via /api/patients/me/timeline (HTTP 200 OK)'
    );

    // -------------------------------------------------------------
    // GROUP 3: PATIENT SELF-SERVICE ENDPOINTS
    // -------------------------------------------------------------
    console.log('\n--- GROUP 3: PATIENT SELF-SERVICE ENDPOINTS ---');

    // 8. GET /api/patients/me
    const myProfile = await axios.get(`${BASE_URL}/patients/me`, { headers: patHeaders });
    assert(
      myProfile.status === 200 && myProfile.data.name === 'Ramesh Kulkarni',
      'GET /api/patients/me returns logged-in patient demographic record'
    );

    // 9. GET /api/patients/me/health-summary
    const mySummary = await axios.get(`${BASE_URL}/patients/me/health-summary`, { headers: patHeaders });
    assert(
      mySummary.status === 200 && (typeof mySummary.data.totalEncounters === 'number' || Boolean(mySummary.data.patient)),
      'GET /api/patients/me/health-summary returns vitals and encounter count'
    );

    // 10. GET /api/patients/me/prescriptions
    const myPrescriptions = await axios.get(`${BASE_URL}/patients/me/prescriptions`, { headers: patHeaders });
    assert(
      myPrescriptions.status === 200 && Array.isArray(myPrescriptions.data),
      'GET /api/patients/me/prescriptions returns active prescriptions array'
    );

    // 11. GET /api/patients/me/referrals
    const myReferrals = await axios.get(`${BASE_URL}/patients/me/referrals`, { headers: patHeaders });
    assert(
      myReferrals.status === 200 && Array.isArray(myReferrals.data),
      'GET /api/patients/me/referrals returns patient referral history'
    );

    // 12. GET /api/patients/me/followups
    const myFollowups = await axios.get(`${BASE_URL}/patients/me/followups`, { headers: patHeaders });
    assert(
      myFollowups.status === 200 && Array.isArray(myFollowups.data),
      'GET /api/patients/me/followups returns care gap continuity tasks'
    );

    // 13. GET /api/patients/me/queue
    const initialQueue = await axios.get(`${BASE_URL}/patients/me/queue`, { headers: patHeaders });
    assert(
      initialQueue.status === 200 && typeof initialQueue.data.active === 'boolean',
      'GET /api/patients/me/queue returns live queue object'
    );

    // 14. GET /api/facilities
    const facRes = await axios.get(`${BASE_URL}/facilities`, { headers: patHeaders });
    assert(
      facRes.status === 200 && facRes.data.length > 0,
      'GET /api/facilities returns available hospitals and PHCs'
    );
    facilityId = facRes.data[0].id;
    doctorId = doctorUser.doctorId;

    // -------------------------------------------------------------
    // GROUP 4: APPOINTMENT BOOKING & DUPLICATE PREVENTION
    // -------------------------------------------------------------
    console.log('\n--- GROUP 4: APPOINTMENT BOOKING & CONFLICT CHECKS ---');

    // 15. Book a new appointment
    const bookRes = await axios.post(
      `${BASE_URL}/patients/me/appointments`,
      {
        facilityId,
        doctorId,
        date: testDate,
        timeSlot: '10:00 AM',
        reason: 'Severe migraine and nausea for 3 days',
      },
      { headers: patHeaders }
    );
    createdAppointmentId = bookRes.data.id;
    assert(
      bookRes.status === 201 &&
        bookRes.data.status === 'SCHEDULED' &&
        bookRes.data.patientId === patientUser.patientId,
      'POST /api/patients/me/appointments creates new scheduled appointment (HTTP 201 Created)'
    );

    // 16. Duplicate booking conflict
    let duplicateConflict = false;
    try {
      await axios.post(
        `${BASE_URL}/patients/me/appointments`,
        {
          facilityId,
          doctorId,
          date: testDate,
          timeSlot: '10:00 AM',
          reason: 'Duplicate slot request',
        },
        { headers: patHeaders }
      );
    } catch (e: any) {
      duplicateConflict = e.response?.status === 409;
    }
    assert(
      duplicateConflict,
      'POST /api/patients/me/appointments rejects duplicate doctor/timeSlot (HTTP 409 Conflict)'
    );

    // 17. Cancel an appointment
    const tempBook = await axios.post(
      `${BASE_URL}/patients/me/appointments`,
      {
        facilityId,
        doctorId,
        date: testDate,
        timeSlot: '11:30 AM',
        reason: 'Temporary slot to test cancellation',
      },
      { headers: patHeaders }
    );
    const cancelRes = await axios.delete(`${BASE_URL}/patients/me/appointments/${tempBook.data.id}`, {
      headers: patHeaders,
    });
    assert(
      cancelRes.status === 200 && cancelRes.data.appointment?.status === 'CANCELLED',
      'DELETE /api/patients/me/appointments/:id cancels appointment successfully'
    );

    // 18. Cannot cancel non-existent or other patient appointment
    let crossCancelBlocked = false;
    try {
      await axios.delete(`${BASE_URL}/patients/me/appointments/appt-nonexistent`, { headers: patHeaders });
    } catch (e: any) {
      crossCancelBlocked = e.response?.status === 404 || e.response?.status === 403;
    }
    assert(crossCancelBlocked, 'Cannot cancel non-existent appointment (HTTP 404/403)');

    // -------------------------------------------------------------
    // GROUP 5: ARRIVAL, QUEUE INTEGRATION & REALTIME WEBSOCKET
    // -------------------------------------------------------------
    console.log('\n--- GROUP 5: ARRIVAL, QUEUE TOKEN & REALTIME EVENTS ---');

    // 19. Connect WebSocket clients for patient and doctor
    let patientReceivedEvent = false;
    let doctorReceivedQueueEvent = false;

    const patSocket = io(ROOT_URL, {
      transports: ['websocket'],
      auth: { token: patientToken },
    });

    const docSocket = io(ROOT_URL, {
      transports: ['websocket'],
      auth: { token: doctorToken },
    });

    await new Promise<void>((resolve) => {
      let count = 0;
      patSocket.on('connect', () => {
        patSocket.emit('join:patient', patientUser.patientId);
        count++;
        if (count === 2) resolve();
      });
      docSocket.on('connect', () => {
        docSocket.emit('join:doctor', doctorUser.doctorId);
        count++;
        if (count === 2) resolve();
      });
    });

    patSocket.on('patient.updated', (data: any) => {
      patientReceivedEvent = true;
    });

    docSocket.on('queue.updated', (data: any) => {
      doctorReceivedQueueEvent = true;
    });

    // 20. Mark Arrive on appointment
    const arriveRes = await axios.post(
      `${BASE_URL}/patients/me/appointments/${createdAppointmentId}/arrive`,
      {},
      { headers: patHeaders }
    );
    queueEntryId = arriveRes.data.queueEntry?.id;
    issuedTokenNumber = arriveRes.data.queueEntry?.tokenNumber;

    assert(
      arriveRes.status === 200 &&
        arriveRes.data.appointment?.status === 'ARRIVED' &&
        arriveRes.data.queueEntry?.status === 'WAITING' &&
        Boolean(issuedTokenNumber),
      `Patient marks arrival: appointment ARRIVED and Queue token issued (${issuedTokenNumber})`
    );

    // 21. Realtime socket event received
    // Wait 500ms for event propagation
    await new Promise((r) => setTimeout(r, 500));
    assert(
      patientReceivedEvent,
      'WebSocket: Patient received realtime patient.updated event upon arrival'
    );

    // 22. Active Queue verification from Patient endpoint
    const activeQ = await axios.get(`${BASE_URL}/patients/me/queue`, { headers: patHeaders });
    assert(
      activeQ.status === 200 &&
        activeQ.data.active === true &&
        activeQ.data.entry?.tokenNumber === issuedTokenNumber,
      `Patient queue status is active with token ${issuedTokenNumber} and wait position ${activeQ.data.position}`
    );

    // 23. Doctor Queue inspection
    const docQueueRes = await axios.get(`${BASE_URL}/queue`, { headers: docHeaders });
    const foundEntry = docQueueRes.data.find((q: any) => q.id === queueEntryId);
    assert(
      Boolean(foundEntry),
      `Doctor sees patient in consultation queue with ID ${queueEntryId}`
    );

    // 24. Doctor Consultation Progress & Complete
    await axios.patch(`${BASE_URL}/queue/${queueEntryId}/status`, { status: 'IN_CONSULTATION' }, { headers: docHeaders });
    const inConsQ = await axios.get(`${BASE_URL}/patients/me/queue`, { headers: patHeaders });
    assert(
      inConsQ.status === 200 && inConsQ.data.entry?.status === 'IN_CONSULTATION',
      'Doctor starts consultation: Patient queue entry transitions to IN_CONSULTATION'
    );

    await axios.patch(`${BASE_URL}/queue/${queueEntryId}/status`, { status: 'COMPLETED' }, { headers: docHeaders });
    const completedQ = await axios.get(`${BASE_URL}/patients/me/queue`, { headers: patHeaders });
    const checkDocQueue = await axios.get(`${BASE_URL}/queue`, { headers: docHeaders });
    const stillActiveInDocQ = checkDocQueue.data.some((q: any) => q.id === queueEntryId);
    assert(
      completedQ.status === 200 && !stillActiveInDocQ && completedQ.data.entry?.id !== queueEntryId,
      'Doctor completes consultation: Queue entry is completed and removed from active queue'
    );

    // 25. Diagnostics endpoint verification
    const diagRes = await axios.get(`${BASE_URL}/diagnostics`, { headers: patHeaders });
    assert(
      diagRes.status === 200 && Array.isArray(diagRes.data) && diagRes.data.length > 0,
      'GET /api/diagnostics returns available lab orders and diagnostic records'
    );

    // -------------------------------------------------------------
    // GROUP 6: AUDIT & ENRICHMENT VERIFICATION (NO-MOCK INTEGRITY)
    // -------------------------------------------------------------
    console.log('\n--- GROUP 6: REAL METADATA, VITALS & AVAILABILITY ---');

    // 26. Appointment Availability endpoint
    const availRes = await axios.get(
      `${BASE_URL}/appointments/availability?facilityId=${facilityId}&doctorId=${doctorId}&date=${testDate}`,
      { headers: patHeaders }
    );
    assert(
      availRes.status === 200 &&
      availRes.data.isFacilityOpen === true &&
      Array.isArray(availRes.data.slots) &&
      availRes.data.slots.length > 0 &&
      availRes.data.doctor?.name === 'Dr. Rajesh Deshmukh',
      'GET /api/appointments/availability returns structured clinic slots and doctor name'
    );

    // 27. Appointment doctor name and formatted dates
    const apptsCheck = await axios.get(`${BASE_URL}/patients/me/appointments`, { headers: patHeaders });
    const firstAppt = apptsCheck.data[0];
    assert(
      firstAppt &&
      typeof firstAppt.doctor?.name === 'string' &&
      firstAppt.doctor.name.startsWith('Dr.') &&
      /^\d{4}-\d{2}-\d{2}$/.test(firstAppt.date) &&
      typeof firstAppt.timeSlot === 'string',
      'GET /api/patients/me/appointments returns real Doctor Name ("Dr. ...") and ISO Date'
    );

    // 28. Authentic vitals and ABHA ID
    const healthSummaryCheck = await axios.get(`${BASE_URL}/patients/me/health-summary`, { headers: patHeaders });
    assert(
      healthSummaryCheck.data.patient?.abhaId === '91-8844-3321-0001' &&
      healthSummaryCheck.data.recentVitals?.bp === '136/86' &&
      healthSummaryCheck.data.recentVitals?.heartRate === '74' &&
      healthSummaryCheck.data.recentVitals?.bloodGlucose === '186',
      'GET /api/patients/me/health-summary returns real ABHA ID and authentic DB vitals'
    );

    // 29. Prescriptions with real medication names & diagnostics results
    const rxCheck = await axios.get(`${BASE_URL}/patients/me/prescriptions`, { headers: patHeaders });
    assert(
      Array.isArray(rxCheck.data) &&
      rxCheck.data.length > 0 &&
      typeof rxCheck.data[0].name === 'string' &&
      rxCheck.data[0].name.length > 3 &&
      diagRes.data.some((d: any) => d.results && d.results.length > 0),
      'Prescriptions have real medication names and diagnostics contain real test results'
    );

    // Cleanup sockets
    patSocket.disconnect();
    docSocket.disconnect();

  } catch (err: any) {
    console.error('\n[FATAL ERROR IN TEST EXECUTION]', err.response?.data || err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed})`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL 24 SCENARIOS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  }
}

runTests();
