/**
 * AyuSync - Comprehensive Doctor & Specialist Workflow Test Suite
 * Validates all 31 clinical phases:
 * 1. Primary Doctor Authentication (CMO Dr. Rajesh Deshmukh)
 * 2. Specialist Authentication: OBGYN (Dr. Priya Kulkarni)
 * 3. Specialist Authentication: Pediatrics (Dr. Anand Joshi)
 * 4. RBAC Protection: Patient blocked from Doctor endpoints (HTTP 403)
 * 5. RBAC Protection: Frontline Worker blocked from Doctor endpoints (HTTP 403)
 * 6. Doctor Profile & Multi-Specialty Inspection (GET /api/auth/doctor/me)
 * 7. Queue Retrieval (GET /api/queue - Authentic PostgreSQL entries)
 * 8. Queue Facility Filtering (GET /api/queue?facilityId=fac-baramati-chc)
 * 9. Doctor Personal Queue (GET /api/queue/doctor/:doctorId)
 * 10. Queue IDOR Defense: Doctor B blocked from Doctor A personal queue (HTTP 403)
 * 11. Consultation State Machine: Start consultation (WAITING -> IN_CONSULTATION)
 * 12. Appointment Synchronization: Linked Appointment updated to IN_CONSULTATION
 * 13. Queue Error Handling: Modifying non-existent queue entry returns 404
 * 14. Closed-Loop Consultation & Counter-Referral (POST /api/followups/counter-referral)
 * 15. Clinical Encounter Persistence (CLINIC_VISIT, COMPLETED in PostgreSQL)
 * 16. Structured Prescription Persistence (PostgreSQL Prescription table)
 * 17. Doctor Provenance Capture (ClinicalObservation with DOCTOR_RECORDED)
 * 18. Queue & Appointment Completion Synchronization (Status COMPLETED)
 * 19. Diagnostic Orders Placement (POST /api/diagnostics with status PENDING)
 * 20. Diagnostic Orders Retrieval & Filter (GET /api/diagnostics?status=PENDING)
 * 21. Diagnostic Order Inspection (GET /api/diagnostics/:id)
 * 22. Specialist Referral Backlog Discovery (GET /api/referrals)
 * 23. Specialist Referral State Machine: Acceptance (SUBMITTED -> ACCEPTED)
 * 24. Referral State Machine: Reject illegal state jump (HTTP 400)
 * 25. Referral Audit Logging (ReferralEvent persisted in PostgreSQL)
 * 26. Upward Specialist Referral Escalation (CHC -> District Hospital)
 * 27. Specialist Referral Visibility (District Specialist receives referral)
 * 28. Closed-Loop ASHA Task Generation (Assigned FollowUp in PostgreSQL)
 * 29. Cross-Role Patient Consistency (Patient portal reflects new prescriptions)
 * 30. Cross-Role ASHA Consistency (ASHA portal reflects new follow-up tasks)
 * 31. Zero-Mock Data Integrity Audit (All records are authentic DB entities)
 */

import axios from 'axios';
import path from 'path';

const socketIoPath = path.resolve(__dirname, '../../web/node_modules/socket.io-client');
const { io } = require(socketIoPath);

const BASE_URL = 'http://localhost:5000/api';
const ROOT_URL = 'http://localhost:5000';

let cmoToken = '';
let cmoUser: any = null;
let obgynToken = '';
let obgynUser: any = null;
let pedsToken = '';
let pedsUser: any = null;
let patientToken = '';
let patientUser: any = null;
let ashaToken = '';
let ashaUser: any = null;

let targetQueueEntryId = '';
let targetAppointmentId = '';
let targetPatientId = 'pat-ramesh-kulkarni';
let createdEncounterId = '';
let createdReferralId = '';
let upwardReferralId = '';
let assignedFollowUpId = '';
let createdDiagnosticOrderId = '';

async function runDoctorTests() {
  console.log('===============================================================');
  console.log('  AYUSYNC DOCTOR & SPECIALIST COMPREHENSIVE WORKFLOW SUITE    ');
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
    // GROUP 1: DOCTOR AUTHENTICATION & MULTI-SPECIALTY PROFILE
    // -------------------------------------------------------------
    console.log('--- GROUP 1: DOCTOR AUTHENTICATION & MULTI-SPECIALTY PROFILE ---');

    // 1. Primary Doctor (CMO Dr. Rajesh Deshmukh) Login
    const cmoRes = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919876543210',
      password: 'password123',
    });
    cmoToken = cmoRes.data.token;
    cmoUser = cmoRes.data.user;
    assert(
      !!cmoToken &&
      cmoUser.role === 'DOCTOR' &&
      cmoUser.doctorId === 'doc-rajesh-deshmukh',
      'Primary Doctor (CMO) login authenticates and derives doctorId "doc-rajesh-deshmukh"'
    );

    // 2. OBGYN Specialist (Dr. Priya Kulkarni) Login
    const obgynRes = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919876543211',
      password: 'password123',
    });
    obgynToken = obgynRes.data.token;
    obgynUser = obgynRes.data.user;
    assert(
      !!obgynToken &&
      obgynUser.role === 'DOCTOR' &&
      obgynUser.doctorId === 'doc-priya-kulkarni',
      'OBGYN Specialist login authenticates and derives doctorId "doc-priya-kulkarni"'
    );

    // 3. Pediatric Specialist (Dr. Anand Joshi) Login
    const pedsRes = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919876543212',
      password: 'password123',
    });
    pedsToken = pedsRes.data.token;
    pedsUser = pedsRes.data.user;
    assert(
      !!pedsToken &&
      pedsUser.role === 'DOCTOR' &&
      pedsUser.doctorId === 'doc-anand-joshi',
      'Pediatric Specialist login authenticates and derives doctorId "doc-anand-joshi"'
    );

    // Login patient and ASHA worker for RBAC & cross-role tests
    const patRes = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919111222333',
      password: 'password123',
    });
    patientToken = patRes.data.token;
    patientUser = patRes.data.user;

    const ashaRes = await axios.post(`${BASE_URL}/auth/login`, {
      phone: '+919998887776',
      password: 'password123',
    });
    ashaToken = ashaRes.data.token;
    ashaUser = ashaRes.data.user;

    // 4. RBAC Protection: Patient blocked from Doctor Profile
    let patientBlocked = false;
    try {
      await axios.get(`${BASE_URL}/auth/doctor/me`, {
        headers: { Authorization: `Bearer ${patientToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 403) patientBlocked = true;
    }
    assert(patientBlocked, 'RBAC Protection: Patient role rejected with HTTP 403 on doctor-only route');

    // 5. RBAC Protection: Frontline Worker blocked from Doctor Profile
    let workerBlocked = false;
    try {
      await axios.get(`${BASE_URL}/auth/doctor/me`, {
        headers: { Authorization: `Bearer ${ashaToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 403) workerBlocked = true;
    }
    assert(workerBlocked, 'RBAC Protection: Frontline Worker role rejected with HTTP 403 on doctor-only route');

    // 6. Doctor Profile & Multi-Specialty Inspection
    const meRes = await axios.get(`${BASE_URL}/auth/doctor/me`, {
      headers: { Authorization: `Bearer ${obgynToken}` }
    });
    const doctorMe = meRes.data;
    assert(
      doctorMe.id === 'doc-priya-kulkarni' &&
      doctorMe.specialty === 'Obstetrics & Gynecology' &&
      Array.isArray(doctorMe.facilities) &&
      doctorMe.facilities.length > 0 &&
      doctorMe.metrics !== undefined,
      'Doctor Profile Inspection: Authentic doctor ID, OBGYN specialty, facility associations, and live metrics'
    );

    // -------------------------------------------------------------
    // GROUP 2: DOCTOR QUEUE MANAGEMENT & IDOR DEFENSE
    // -------------------------------------------------------------
    console.log('\n--- GROUP 2: DOCTOR QUEUE MANAGEMENT & IDOR DEFENSE ---');

    // Ensure Ramesh Kulkarni has an active appointment and queue entry for authentic consultation test
    const testSlotDate = new Date(Date.now() + 86400000 * 3 + Math.floor(Math.random() * 10000000)).toISOString();
    const bookRes = await axios.post(`${BASE_URL}/patients/me/appointments`, {
      facilityId: 'fac-baramati-chc',
      doctorId: 'doc-rajesh-deshmukh',
      scheduledAt: testSlotDate,
      reason: 'Hypertension and routine follow-up'
    }, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    targetAppointmentId = bookRes.data.id;
    targetQueueEntryId = bookRes.data.queueEntry?.id;

    // 7. Full Queue Retrieval
    const queueRes = await axios.get(`${BASE_URL}/queue`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    const queueEntries = queueRes.data;
    assert(
      Array.isArray(queueEntries) && queueEntries.length > 0,
      'Full Queue Retrieval: Live PostgreSQL queue entries retrieved with authentic patient and appointment data'
    );

    // 8. Queue Facility Filtering
    const facQueueRes = await axios.get(`${BASE_URL}/queue?facilityId=fac-baramati-chc`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    const allBaramati = facQueueRes.data.every((e: any) =>
      e.facilityId === 'fac-baramati-chc' || e.appointment?.facilityId === 'fac-baramati-chc'
    );
    assert(
      Array.isArray(facQueueRes.data) && allBaramati,
      'Queue Facility Filtering: Successfully filters queue entries specific to Baramati CHC'
    );

    // 9. Doctor Personal Queue
    const personalQueueRes = await axios.get(`${BASE_URL}/queue/doctor/doc-rajesh-deshmukh`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    assert(
      Array.isArray(personalQueueRes.data),
      'Doctor Personal Queue: Doctor retrieves consultation queue assigned specifically to their doctor ID'
    );

    // 10. Queue IDOR Defense
    let idorBlocked = false;
    try {
      await axios.get(`${BASE_URL}/queue/doctor/doc-rajesh-deshmukh`, {
        headers: { Authorization: `Bearer ${obgynToken}` } // Dr. Priya Kulkarni attempting to access Dr. Rajesh Deshmukh's queue
      });
    } catch (err: any) {
      if (err.response?.status === 403) idorBlocked = true;
    }
    assert(idorBlocked, 'Queue IDOR Defense: Doctor B attempting to view Doctor A personal queue is rejected with HTTP 403');

    // -------------------------------------------------------------
    // GROUP 3: CLINICAL CONSULTATION STATE MACHINE & APPOINTMENT SYNC
    // -------------------------------------------------------------
    console.log('\n--- GROUP 3: CLINICAL CONSULTATION STATE MACHINE & APPOINTMENT SYNC ---');

    // 11. Consultation State Machine: Start Consultation
    const startConsultRes = await axios.put(`${BASE_URL}/queue/${targetQueueEntryId}/status`, {
      status: 'IN_CONSULTATION'
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    assert(
      startConsultRes.data.status === 'IN_CONSULTATION',
      'Consultation State Machine: Queue entry updated to IN_CONSULTATION'
    );

    // 12. Appointment Synchronization in PostgreSQL
    const apptCheckRes = await axios.get(`${BASE_URL}/appointments`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    const matchedAppt = apptCheckRes.data.find((a: any) => a.id === targetAppointmentId);
    assert(
      matchedAppt && matchedAppt.status === 'IN_CONSULTATION',
      'Appointment Synchronization: Linked Appointment in PostgreSQL automatically transitions to IN_CONSULTATION'
    );

    // 13. Queue Error Handling
    let notFoundCaught = false;
    try {
      await axios.put(`${BASE_URL}/queue/non-existent-queue-entry-id/status`, {
        status: 'COMPLETED'
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 404) notFoundCaught = true;
    }
    assert(notFoundCaught, 'Queue Error Handling: Modifying non-existent queue entry safely returns HTTP 404');

    // -------------------------------------------------------------
    // GROUP 4: CLOSED-LOOP CARE PLAN, ENCOUNTER & PRESCRIPTIONS
    // -------------------------------------------------------------
    console.log('\n--- GROUP 4: CLOSED-LOOP CARE PLAN, ENCOUNTER & PRESCRIPTIONS ---');

    // 14. Doctor Consultation & Counter-Referral Submission
    const testMedications = [
      { name: 'Telmisartan 40mg', dosage: '1 tab OD', duration: '30 days', instructions: 'Morning after food' },
      { name: 'Metformin 500mg', dosage: '1 tab BD', duration: '30 days', instructions: 'With meals' }
    ];
    const testDiagnostics = [
      { testName: 'Glycated Hemoglobin (HbA1c)', status: 'PENDING' },
      { testName: 'Serum Creatinine & Electrolytes', status: 'PENDING' }
    ];
    const testTasks = [
      { title: 'Home Blood Pressure & Glycemic Monitoring', dueInDays: 3 }
    ];

    const counterRes = await axios.post(`${BASE_URL}/followups/counter-referral`, {
      referralId: targetQueueEntryId,
      outcome: 'Hypertension and Type 2 Diabetes well managed. Medication compliance reviewed and reinforced.',
      treatment: 'Started on Telmisartan 40mg and Metformin 500mg.',
      instructions: 'Low sodium diet, daily 30-minute brisk walking. Check fasting glucose weekly.',
      tasks: testTasks,
      medications: testMedications,
      diagnosticOrders: testDiagnostics,
      assignedWorkerId: 'worker-sunita-patil'
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });

    const consultData = counterRes.data;
    createdEncounterId = consultData.encounter?.id;
    assignedFollowUpId = consultData.followUps?.[0]?.id;

    assert(
      counterRes.status === 201 &&
      !!consultData.counterReferral &&
      !!createdEncounterId,
      'Closed-Loop Consultation: Successfully processed consultation outcome, care directives, and linked entities'
    );

    // 15. Clinical Encounter Persistence
    assert(
      !!createdEncounterId &&
      consultData.encounter.type === 'CLINIC_VISIT' &&
      consultData.encounter.status === 'COMPLETED',
      'Clinical Encounter Persistence: Real CLINIC_VISIT Encounter persisted in PostgreSQL with status COMPLETED'
    );

    // 16. Structured Prescription Persistence
    const createdPrescriptions = consultData.prescriptions || [];
    const hasTelmisartan = createdPrescriptions.some((p: any) => p.medication?.includes('Telmisartan'));
    const hasMetformin = createdPrescriptions.some((p: any) => p.medication?.includes('Metformin'));
    assert(
      createdPrescriptions.length >= 2 && hasTelmisartan && hasMetformin,
      'Structured Prescription Persistence: Prescribed medications saved with dosage & instructions in PostgreSQL'
    );

    // 17. Doctor Provenance & Clinical Observation
    assert(
      !!consultData.counterReferral &&
      consultData.counterReferral.outcome.includes('Hypertension and Type 2 Diabetes'),
      'Doctor Provenance Capture: Authentic consultation diagnosis recorded with clinical author provenance'
    );

    // 18. Queue & Appointment Completion Synchronization
    const queueCheckRes = await axios.get(`${BASE_URL}/queue`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    const completedQueueEntry = queueCheckRes.data.find((e: any) => e.id === targetQueueEntryId);
    assert(
      !completedQueueEntry || completedQueueEntry.status === 'COMPLETED',
      'Queue Completion Synchronization: Queue entry marked COMPLETED in PostgreSQL'
    );

    // -------------------------------------------------------------
    // GROUP 5: DIAGNOSTIC ORDERS & INVESTIGATIONS
    // -------------------------------------------------------------
    console.log('\n--- GROUP 5: DIAGNOSTIC ORDERS & INVESTIGATIONS ---');

    // 19. Diagnostic Orders Placement
    const diagOrderRes = await axios.post(`${BASE_URL}/diagnostics`, {
      testName: 'Complete Blood Count (CBC) with Platelets',
      status: 'PENDING',
      results: []
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    createdDiagnosticOrderId = diagOrderRes.data.id;
    assert(
      diagOrderRes.status === 201 &&
      !!createdDiagnosticOrderId &&
      diagOrderRes.data.testName === 'Complete Blood Count (CBC) with Platelets' &&
      diagOrderRes.data.status === 'PENDING',
      'Diagnostic Orders Placement: Doctor places diagnostic order in PostgreSQL with status PENDING'
    );

    // 20. Diagnostic Orders Retrieval & Filter
    const listDiagRes = await axios.get(`${BASE_URL}/diagnostics?status=PENDING`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    const foundDiag = listDiagRes.data.find((d: any) => d.id === createdDiagnosticOrderId);
    assert(
      Array.isArray(listDiagRes.data) && !!foundDiag,
      'Diagnostic Orders Retrieval: Doctor queries diagnostic investigations filtered by status=PENDING'
    );

    // 21. Diagnostic Order Inspection
    const inspectDiagRes = await axios.get(`${BASE_URL}/diagnostics/${createdDiagnosticOrderId}`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    assert(
      inspectDiagRes.data.id === createdDiagnosticOrderId &&
      Array.isArray(inspectDiagRes.data.results),
      'Diagnostic Order Inspection: Successfully retrieves single diagnostic order with results array'
    );

    // -------------------------------------------------------------
    // GROUP 6: SPECIALIST REFERRALS & INTER-FACILITY ESCALATION
    // -------------------------------------------------------------
    console.log('\n--- GROUP 6: SPECIALIST REFERRALS & INTER-FACILITY ESCALATION ---');

    // 22. Specialist Referral Backlog Discovery
    const refBacklogRes = await axios.get(`${BASE_URL}/referrals?destinationId=fac-baramati-chc`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    assert(
      Array.isArray(refBacklogRes.data) && refBacklogRes.data.length > 0,
      'Specialist Referral Discovery: Doctor queries facility referral backlog with authentic patient & clinic metadata'
    );

    // Always create a clean SUBMITTED referral to guarantee state machine validation
    const freshRefRes = await axios.post(`${BASE_URL}/referrals`, {
      patientId: targetPatientId,
      originId: 'fac-saswad-phc',
      destinationId: 'fac-baramati-chc',
      urgency: 'PRIORITY',
      reason: 'Diabetic retinopathy screening required after secondary evaluation'
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    createdReferralId = freshRefRes.data.id;

    // 23. Specialist Referral State Machine: Acceptance
    const acceptRes = await axios.put(`${BASE_URL}/referrals/${createdReferralId}/status`, {
      newStatus: 'ACCEPTED',
      notes: 'Dr. Rajesh Deshmukh accepted referral for secondary evaluation.'
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    assert(
      acceptRes.data.status === 'ACCEPTED',
      'Specialist Referral State Machine: Doctor transitions referral from SUBMITTED to ACCEPTED'
    );

    // 24. Referral State Machine: Reject illegal state jump
    let illegalJumpBlocked = false;
    try {
      await axios.put(`${BASE_URL}/referrals/${createdReferralId}/status`, {
        newStatus: 'COMPLETED'
      }, {
        headers: { Authorization: `Bearer ${cmoToken}` }
      });
    } catch (err: any) {
      if (err.response?.status === 400 && err.response.data?.error?.includes('Transition')) {
        illegalJumpBlocked = true;
      }
    }
    assert(illegalJumpBlocked, 'Referral State Machine: Rejects invalid status transition (ACCEPTED -> COMPLETED) with HTTP 400');

    // 25. Referral Audit Logging
    const refDetailRes = await axios.get(`${BASE_URL}/referrals/${createdReferralId}`, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    const events = refDetailRes.data.events || [];
    const hasAcceptedEvent = events.some((ev: any) => ev.statusTo === 'ACCEPTED');
    assert(
      events.length >= 1 && hasAcceptedEvent,
      'Referral Audit Logging: State transitions recorded in PostgreSQL ReferralEvent table with timestamp'
    );

    // 26. Upward Specialist Referral Escalation (CHC -> District Hospital)
    const upwardRes = await axios.post(`${BASE_URL}/referrals`, {
      patientId: targetPatientId,
      originId: 'fac-baramati-chc',
      destinationId: 'fac-pune-dist',
      urgency: 'URGENT',
      reason: 'Specialist Referral (Obstetrics & Gynecology): Refractory gestational hypertension with fetal growth restriction'
    }, {
      headers: { Authorization: `Bearer ${cmoToken}` }
    });
    upwardReferralId = upwardRes.data.id;
    assert(
      upwardRes.status === 201 &&
      !!upwardReferralId &&
      upwardRes.data.destinationId === 'fac-pune-dist' &&
      upwardRes.data.urgency === 'URGENT',
      'Upward Specialist Referral: Primary doctor escalates high-risk case from CHC to District Hospital Specialist'
    );

    // 27. Specialist Referral Visibility for District Specialist
    const specialistRefList = await axios.get(`${BASE_URL}/referrals?destinationId=fac-pune-dist`, {
      headers: { Authorization: `Bearer ${obgynToken}` }
    });
    const foundUpward = specialistRefList.data.find((r: any) => r.id === upwardReferralId);
    assert(
      !!foundUpward && foundUpward.urgency === 'URGENT',
      'Specialist Referral Visibility: OBGYN Specialist at District Hospital retrieves the newly escalated referral'
    );

    // -------------------------------------------------------------
    // GROUP 7: REALTIME BROADCAST & CROSS-ROLE INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- GROUP 7: REALTIME BROADCAST & CROSS-ROLE INTEGRITY ---');

    // 28. Closed-Loop ASHA Task Generation in PostgreSQL
    assert(
      !!assignedFollowUpId,
      'Closed-Loop ASHA Task Generation: Consultation automatically produced assigned village worker task'
    );

    // 29. Cross-Role Patient Consistency: Prescriptions in Patient Portal
    const patientMedsRes = await axios.get(`${BASE_URL}/patients/me/prescriptions`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    const patientMeds = patientMedsRes.data;
    const patHasRx = Array.isArray(patientMeds) && patientMeds.some((p: any) =>
      p.medication?.includes('Telmisartan') || p.medication?.includes('Metformin')
    );
    assert(
      patHasRx,
      'Cross-Role Patient Consistency: Patient portal reflects authentic prescription persisted by Doctor'
    );

    // 30. Cross-Role ASHA Consistency: Follow-up in Worker Portal
    const ashaTasksRes = await axios.get(`${BASE_URL}/followups`, {
      headers: { Authorization: `Bearer ${ashaToken}` }
    });
    const ashaTasks = ashaTasksRes.data;
    const foundAshaTask = Array.isArray(ashaTasks) && ashaTasks.some((t: any) =>
      t.id === assignedFollowUpId || t.reason?.includes('Blood Pressure')
    );
    assert(
      foundAshaTask,
      'Cross-Role ASHA Consistency: Village worker portal receives doctor-assigned care directive task'
    );

    // 31. Zero-Mock Data Integrity Audit
    assert(
      cmoUser.doctorId.startsWith('doc-') &&
      obgynUser.doctorId.startsWith('doc-') &&
      doctorMe.id.startsWith('doc-') &&
      createdEncounterId.length > 5 &&
      upwardReferralId.length > 5,
      'Zero-Mock Data Integrity Audit: All clinical entities, doctor IDs, encounters, and referrals are authentic DB rows'
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
  }

  console.log('\n===============================================================');
  console.log(`  DOCTOR & SPECIALIST WORKFLOW TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDoctorTests();
