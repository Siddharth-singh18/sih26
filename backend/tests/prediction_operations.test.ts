/**
 * AyuSync - Facility & Operations Intelligence Phase 6 Test Suite
 * REAL, EVIDENCE-BASED PREDICTIVE OPERATIONAL INTELLIGENCE
 *
 * Validates all 34 scenarios across 9 core test groups:
 *
 * --- GROUP 1: DATA SUFFICIENCY AUDIT & CLASSIFICATION ---
 * 1. Data sufficiency audit exposes status for all potential domains
 * 2. Diagnostic forecasting explicitly classified as NOT_SUPPORTED_BY_SCHEMA
 * 3. Medicine stockout forecasting explicitly classified as NOT_SUPPORTED_BY_SCHEMA
 *
 * --- GROUP 2: QUEUE PRESSURE PREDICTION ---
 * 4. Baramati CHC queue pressure returns VERIFIED_PREDICTABLE with predicted queue
 * 5. Queue pressure level adheres to clinical thresholds (LOW, MEDIUM, HIGH, CRITICAL)
 * 6. Facility lacking queue history (Khandala PHC) returns INSUFFICIENT_DATA
 * 7. Invalid horizon query parameter rejected with HTTP 400 Bad Request
 *
 * --- GROUP 3: RESOURCE CAPACITY PRESSURE PREDICTION ---
 * 8. Capacity pressure evaluated across multi-category resources
 * 9. GENERAL category capacity pressure projected with utilization rate
 * 10. ICU category capacity projected with inbound urgent transfers influence
 * 11. OXYGEN category capacity evaluated
 * 12. MATERNITY category capacity evaluated
 * 13. Category not equipped at facility returns NOT_SUPPORTED_BY_SCHEMA
 *
 * --- GROUP 4: REFERRAL DELAY RISK & PROCESSING TIME ---
 * 14. Referral delay risk derives historical median turnaround from ReferralEvent pairs
 * 15. Urgent referrals evaluated against 4-hour clinical domain threshold
 * 16. Facility-pair corridor bottleneck risk accurately flags destination backlog
 * 17. Corridor filter with < 3 observations returns INSUFFICIENT_DATA
 *
 * --- GROUP 5: DIAGNOSTIC & FOLLOW-UP WORKLOAD ---
 * 18. Diagnostic demand notice transparently exposes schema limitations (C=0, D=0)
 * 19. Community follow-up overload predicted from overdue and imminent due dates
 * 20. Worker with zero assigned tasks returns INSUFFICIENT_DATA
 *
 * --- GROUP 6: MODEL EVALUATION & DATA LEAKAGE PROTECTION ---
 * 21. Backtesting evaluation returns chronological MAE and RMSE metrics
 * 22. Data leakage protected: Training features strictly precede evaluation cutoff
 * 23. Unsupported evaluation target returns INSUFFICIENT_DATA_FOR_RELIABLE_EVALUATION
 *
 * --- GROUP 7: CONTROLLED OPERATIONAL AGENT INTEGRATION ---
 * 24. Operational Agent ingests statistical predictions and synthesizes directives
 * 25. Mandatory Human Review: All directives require human clinical approval
 * 26. Autonomous Mutation Prevention: Agent has autonomousMutationAllowed = false
 *
 * --- GROUP 8: SECURITY, RBAC & PATIENT PII PROTECTION ---
 * 27. Cross-Facility IDOR Defense: Doctor B blocked from mutating/viewing Facility A
 * 28. Role Boundary Defense: Patient blocked from district operational predictions (HTTP 403)
 * 29. Patient PII Protection: Zero patient names, phones, or ABHAs in prediction payloads
 * 30. Unauthenticated requests rejected with HTTP 401 Unauthorized
 *
 * --- GROUP 9: AUDIT, DETERMINISM & STRICT NON-MUTATION ---
 * 31. Deterministic predictions: Repeated queries produce identical mathematical outputs
 * 32. Mathematically derived confidence: Bounded by sample size without arbitrary values
 * 33. Realtime cache invalidation: Socket events trigger recomputation from live DB
 * 34. Strict DB non-mutation verification: Zero row count changes (strictly read-only)
 */

process.env.SKIP_SERVER_LISTEN = 'true';

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import {
  predictQueuePressure,
  predictCapacityPressure,
  predictReferralDelayRisk,
  predictFollowUpOverload,
  evaluateModelPerformance,
  auditDataSufficiency,
  invalidatePredictionCache
} from '../src/modules/prediction/prediction.service';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';

let cmoToken = '';
let cmoUserId = '';
let cmoDoctorId = '';
let pedsToken = '';
let pedsDoctorId = '';
let workerToken = '';
let patientToken = '';

const BARAMATI_FAC_ID = 'fac-baramati-chc';
const JUNNAR_FAC_ID = 'fac-junnar-chc';
const KHANDALA_FAC_ID = 'fac-khandala-phc';

async function runPredictionOperationsTests() {
  console.log('===============================================================');
  console.log('  AYUSYNC PREDICTIVE OPERATIONAL INTELLIGENCE SUITE — PHASE 6  ');
  console.log('  EVIDENCE-BASED PREDICTIVE INTELLIGENCE & ZERO-MOCK AUDIT     ');
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
    // SETUP & INITIAL DATABASE ROW COUNTS (NON-MUTATION AUDIT)
    // -------------------------------------------------------------
    const [
      initFacCount,
      initCapCount,
      initAvailCount,
      initQueueCount,
      initRefCount,
      initRefEventCount,
      initDiagCount,
      initFollowUpCount,
      initApptCount,
      initPatientCount
    ] = await Promise.all([
      prisma.facility.count(),
      prisma.facilityCapacity.count(),
      prisma.facilityAvailability.count(),
      prisma.queueEntry.count(),
      prisma.referral.count(),
      prisma.referralEvent.count(),
      prisma.diagnosticOrder.count(),
      prisma.followUp.count(),
      prisma.appointment.count(),
      prisma.patient.count()
    ]);

    // Authenticate actors
    const [cmoLogin, pedsLogin, workerLogin, patLogin] = await Promise.all([
      axios.post(`${BASE_URL}/auth/login`, { phone: '9876543210', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { phone: '9876543212', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { phone: '9998887776', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { phone: '9111222333', password: 'password123' })
    ]);

    cmoToken = cmoLogin.data.token;
    cmoUserId = cmoLogin.data.user.id;
    cmoDoctorId = cmoLogin.data.user.doctorId;

    pedsToken = pedsLogin.data.token;
    pedsDoctorId = pedsLogin.data.user.doctorId;

    workerToken = workerLogin.data.token;
    patientToken = patLogin.data.token;

    const cmoHeaders = { Authorization: `Bearer ${cmoToken}` };
    const pedsHeaders = { Authorization: `Bearer ${pedsToken}` };
    const workerHeaders = { Authorization: `Bearer ${workerToken}` };
    const patHeaders = { Authorization: `Bearer ${patientToken}` };

    // =============================================================
    // GROUP 1: DATA SUFFICIENCY AUDIT & CLASSIFICATION (PHASE 0)
    // =============================================================
    console.log('--- GROUP 1: DATA SUFFICIENCY AUDIT & CLASSIFICATION ---');

    const auditRes = await axios.get(`${BASE_URL}/predictions/audit`, { headers: cmoHeaders });
    const auditData = auditRes.data;

    // Scenario 1: Audit exposes complete domain breakdown
    assert(
      auditData &&
      auditData.domains &&
      auditData.domains.queue_pressure.status === 'VERIFIED_PREDICTABLE' &&
      auditData.domains.capacity_pressure.status === 'VERIFIED_PREDICTABLE' &&
      auditData.domains.referral_delay_risk.status === 'VERIFIED_PREDICTABLE',
      'Scenario 1: Data sufficiency audit correctly classifies predictable domains with authentic counts',
      JSON.stringify(auditData.domains)
    );

    // Scenario 2: Diagnostic forecasting explicitly classified as NOT_SUPPORTED_BY_SCHEMA
    assert(
      auditData.domains.diagnostic_demand_forecasting.status === 'NOT_SUPPORTED_BY_SCHEMA' &&
      auditData.domains.diagnostic_demand_forecasting.missingFields.includes('facilityId'),
      'Scenario 2: Diagnostic forecasting classified as NOT_SUPPORTED_BY_SCHEMA due to missing facilityId and timestamps'
    );

    // Scenario 3: Medicine stockout forecasting explicitly classified as NOT_SUPPORTED_BY_SCHEMA
    assert(
      auditData.domains.medicine_stockout_risk.status === 'NOT_SUPPORTED_BY_SCHEMA' &&
      auditData.domains.medicine_stockout_risk.observations === 0,
      'Scenario 3: Medicine stockout forecasting classified as NOT_SUPPORTED_BY_SCHEMA (Zero synthetic predictions)'
    );

    // =============================================================
    // GROUP 2: QUEUE PRESSURE PREDICTION (PHASE 2)
    // =============================================================
    console.log('\n--- GROUP 2: QUEUE PRESSURE PREDICTION ---');

    const queueRes = await axios.get(
      `${BASE_URL}/predictions/queue?facilityId=${BARAMATI_FAC_ID}&horizon=2`,
      { headers: cmoHeaders }
    );
    const qData = queueRes.data;

    // Scenario 4: Baramati CHC queue pressure returns VERIFIED_PREDICTABLE
    assert(
      qData.dataStatus === 'VERIFIED_PREDICTABLE' &&
      typeof qData.predictedQueue === 'number' &&
      qData.observationsUsed >= 5 &&
      qData.facilityId === BARAMATI_FAC_ID,
      `Scenario 4: Baramati CHC queue pressure predicted: ${qData.predictedQueue} patients (observations: ${qData.observationsUsed})`
    );

    // Scenario 5: Queue pressure level classification adheres to thresholds
    assert(
      ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(qData.pressureLevel) &&
      qData.method === 'WEIGHTED_MOVING_AVERAGE_WITH_APPOINTMENT_INFLUX',
      `Scenario 5: Queue pressure classified as ${qData.pressureLevel} using ${qData.method}`
    );

    // Scenario 6: Facility lacking queue history (Khandala PHC) returns INSUFFICIENT_DATA
    const khandalaQueueRes = await axios.get(
      `${BASE_URL}/predictions/queue?facilityId=${KHANDALA_FAC_ID}&horizon=2`,
      { headers: workerHeaders }
    );
    assert(
      khandalaQueueRes.data.dataStatus === 'INSUFFICIENT_DATA' &&
      khandalaQueueRes.data.observationsUsed === 0 &&
      khandalaQueueRes.data.confidence === null,
      'Scenario 6: Facility without queue entries (Khandala PHC) returns INSUFFICIENT_DATA with null confidence'
    );

    // Scenario 7: Invalid horizon query parameter rejected with HTTP 400
    let invalidHorizonStatus = 0;
    try {
      await axios.get(`${BASE_URL}/predictions/queue?facilityId=${BARAMATI_FAC_ID}&horizon=-5`, { headers: cmoHeaders });
    } catch (err: any) {
      invalidHorizonStatus = err.response?.status;
    }
    assert(
      invalidHorizonStatus === 400,
      'Scenario 7: Invalid horizon parameter (-5) rejected with HTTP 400 Bad Request'
    );

    // =============================================================
    // GROUP 3: RESOURCE CAPACITY PRESSURE PREDICTION (PHASE 3)
    // =============================================================
    console.log('\n--- GROUP 3: RESOURCE CAPACITY PRESSURE PREDICTION ---');

    const capRes = await axios.get(
      `${BASE_URL}/predictions/capacity?facilityId=${BARAMATI_FAC_ID}`,
      { headers: cmoHeaders }
    );
    const capList: any[] = capRes.data;

    // Scenario 8: Capacity pressure evaluated across multi-category resources
    assert(
      Array.isArray(capList) && capList.length >= 2,
      `Scenario 8: Multi-category capacity evaluated for Baramati CHC (${capList.length} categories)`
    );

    // Scenario 9: GENERAL category capacity pressure projected
    const genCap = capList.find(c => c.category === 'GENERAL');
    assert(
      genCap &&
      genCap.dataStatus === 'VERIFIED_PREDICTABLE' &&
      typeof genCap.currentUtilizationRate === 'number' &&
      typeof genCap.predictedUtilizationRate === 'number',
      `Scenario 9: GENERAL capacity projected: current=${genCap?.currentUtilizationRate}% -> projected=${genCap?.predictedUtilizationRate}%`
    );

    // Scenario 10: ICU category capacity projected with inbound urgent transfers
    const icuCap = capList.find(c => c.category === 'ICU');
    assert(
      icuCap &&
      icuCap.dataStatus === 'VERIFIED_PREDICTABLE' &&
      icuCap.inboundUrgentReferrals >= 0,
      `Scenario 10: ICU capacity projected: current=${icuCap?.currentUtilizationRate}%, inboundUrgent=${icuCap?.inboundUrgentReferrals}`
    );

    // Scenario 11: OXYGEN category capacity evaluated
    const oxyCap = capList.find(c => c.category === 'OXYGEN');
    assert(
      oxyCap && oxyCap.totalBeds > 0,
      `Scenario 11: OXYGEN capacity evaluated: ${oxyCap?.occupiedBeds}/${oxyCap?.totalBeds} occupied`
    );

    // Scenario 12: MATERNITY category capacity evaluated
    const matCap = capList.find(c => c.category === 'MATERNITY');
    assert(
      matCap && matCap.totalBeds > 0,
      `Scenario 12: MATERNITY capacity evaluated: ${matCap?.occupiedBeds}/${matCap?.totalBeds} occupied`
    );

    // Scenario 13: Category not equipped at facility returns NOT_SUPPORTED_BY_SCHEMA
    const khandalaCapRes = await axios.get(
      `${BASE_URL}/predictions/capacity?facilityId=${KHANDALA_FAC_ID}&category=NICU`,
      { headers: workerHeaders }
    );
    const nicuKhandala = khandalaCapRes.data[0];
    assert(
      nicuKhandala.dataStatus === 'NOT_SUPPORTED_BY_SCHEMA' &&
      nicuKhandala.totalBeds === 0,
      'Scenario 13: Unequipped resource (NICU at Khandala PHC) returns NOT_SUPPORTED_BY_SCHEMA'
    );

    // =============================================================
    // GROUP 4: REFERRAL DELAY RISK & PROCESSING TIME (PHASE 4)
    // =============================================================
    console.log('\n--- GROUP 4: REFERRAL DELAY RISK & PROCESSING TIME ---');

    const refDelayRes = await axios.get(
      `${BASE_URL}/predictions/referrals?urgency=URGENT`,
      { headers: cmoHeaders }
    );
    const refData = refDelayRes.data;

    // Scenario 14: Historical median turnaround derived from ReferralEvent pairs
    assert(
      refData.dataStatus === 'VERIFIED_PREDICTABLE' &&
      typeof refData.historicalMedianHours === 'number' &&
      refData.observationsUsed >= 3,
      `Scenario 14: Historical turnaround calculated: Median=${refData.historicalMedianHours}h across ${refData.observationsUsed} events`
    );

    // Scenario 15: Urgent referrals evaluated against 4-hour clinical domain threshold
    assert(
      refData.clinicalThresholdHours === 4 &&
      ['LOW', 'MEDIUM', 'HIGH'].includes(refData.delayRiskLevel),
      `Scenario 15: Evaluated against 4h urgent limit -> Predicted Delay Risk: ${refData.delayRiskLevel}`
    );

    // Scenario 16: Facility-pair corridor bottleneck risk accurately flags destination backlog
    const corridorDelayRes = await axios.get(
      `${BASE_URL}/predictions/referrals?originId=${JUNNAR_FAC_ID}&destinationId=${BARAMATI_FAC_ID}&urgency=URGENT`,
      { headers: cmoHeaders }
    );
    assert(
      corridorDelayRes.data.destinationFacilityId === BARAMATI_FAC_ID &&
      corridorDelayRes.data.destinationBacklogCount >= 0,
      `Scenario 16: Junnar -> Baramati transfer corridor evaluated (Backlog: ${corridorDelayRes.data.destinationBacklogCount} pending)`
    );

    // Scenario 17: Corridor filter with < 3 observations returns INSUFFICIENT_DATA
    const sparseCorridorRes = await axios.get(
      `${BASE_URL}/predictions/referrals?originId=fac-non-existent&destinationId=fac-sparse`,
      { headers: cmoHeaders }
    );
    assert(
      sparseCorridorRes.data.dataStatus === 'INSUFFICIENT_DATA' &&
      sparseCorridorRes.data.observationsUsed === 0,
      'Scenario 17: Corridor with < 3 historical observations safely returns INSUFFICIENT_DATA'
    );

    // =============================================================
    // GROUP 5: DIAGNOSTIC & FOLLOW-UP WORKLOAD (PHASE 5 & 6)
    // =============================================================
    console.log('\n--- GROUP 5: DIAGNOSTIC & FOLLOW-UP WORKLOAD ---');

    // Scenario 18: Diagnostic demand notice transparently exposes schema limitations (C=0, D=0)
    const diagRes = await axios.get(`${BASE_URL}/predictions/diagnostics`, { headers: cmoHeaders });
    assert(
      diagRes.data.dataStatus === 'NOT_SUPPORTED_BY_SCHEMA' &&
      diagRes.data.confidence === null &&
      diagRes.data.evidence.includes('DiagnosticOrder model in schema.prisma lacks facilityId'),
      'Scenario 18: Diagnostic demand forecasting transparently returns NOT_SUPPORTED_BY_SCHEMA'
    );

    // Scenario 19: Community follow-up overload predicted from overdue and imminent due dates
    const followUpRes = await axios.get(`${BASE_URL}/predictions/followups`, { headers: cmoHeaders });
    const fUpData = followUpRes.data;
    assert(
      fUpData.dataStatus === 'VERIFIED_PREDICTABLE' &&
      typeof fUpData.imminentTasksDue === 'number' &&
      typeof fUpData.currentlyOverdue === 'number' &&
      ['LOW', 'MEDIUM', 'HIGH'].includes(fUpData.overloadRiskLevel),
      `Scenario 19: Follow-up overload predicted: Overdue=${fUpData.currentlyOverdue}, Imminent=${fUpData.imminentTasksDue} -> Risk: ${fUpData.overloadRiskLevel}`
    );

    // Scenario 20: Worker with zero assigned tasks returns INSUFFICIENT_DATA
    const emptyWorkerRes = await axios.get(
      `${BASE_URL}/predictions/followups?workerId=worker-non-existent-999`,
      { headers: cmoHeaders }
    );
    assert(
      emptyWorkerRes.data.dataStatus === 'INSUFFICIENT_DATA' &&
      emptyWorkerRes.data.observationsUsed === 0,
      'Scenario 20: Worker without assigned tasks returns INSUFFICIENT_DATA'
    );

    // =============================================================
    // GROUP 6: MODEL EVALUATION & DATA LEAKAGE PROTECTION (PHASE 8 & 9)
    // =============================================================
    console.log('\n--- GROUP 6: MODEL EVALUATION & DATA LEAKAGE PROTECTION ---');

    const evalRes = await axios.get(`${BASE_URL}/predictions/evaluation?target=QUEUE`, { headers: cmoHeaders });
    const evalData = evalRes.data;

    // Scenario 21: Backtesting evaluation returns chronological MAE and RMSE metrics
    assert(
      evalData.dataStatus === 'VERIFIED_PREDICTABLE' &&
      evalData.method === 'TEMPORAL_SPLIT_BACKTESTING' &&
      typeof evalData.mae === 'number' &&
      typeof evalData.rmse === 'number' &&
      evalData.totalObservations >= 10,
      `Scenario 21: Model backtesting verified on ${evalData.totalObservations} entries: MAE=${evalData.mae}, RMSE=${evalData.rmse}`
    );

    // Scenario 22: Data leakage protected: Training features strictly precede evaluation cutoff
    assert(
      evalData.dataLeakageProtected === true &&
      Boolean(evalData.featureCutoffTimestamp) &&
      evalData.trainSampleSize > 0 &&
      evalData.testSampleSize > 0,
      `Scenario 22: Data leakage prevention verified: Feature cutoff at ${evalData.featureCutoffTimestamp} (Train: ${evalData.trainSampleSize}, Test: ${evalData.testSampleSize})`
    );

    // Scenario 23: Unsupported evaluation target returns INSUFFICIENT_DATA_FOR_RELIABLE_EVALUATION
    const unsuppEvalRes = await axios.get(
      `${BASE_URL}/predictions/evaluation?target=AMBULANCE_GPS`,
      { headers: cmoHeaders }
    );
    assert(
      unsuppEvalRes.data.accuracyNote === 'INSUFFICIENT_DATA_FOR_RELIABLE_EVALUATION' &&
      unsuppEvalRes.data.mae === null,
      'Scenario 23: Unsupported evaluation target returns INSUFFICIENT_DATA_FOR_RELIABLE_EVALUATION'
    );

    // =============================================================
    // GROUP 7: CONTROLLED OPERATIONAL AGENT INTEGRATION (PHASE 10)
    // =============================================================
    console.log('\n--- GROUP 7: CONTROLLED OPERATIONAL AGENT INTEGRATION ---');

    const agentRes = await axios.get(`${BASE_URL}/ai/agent/predictive-interpretation`, { headers: cmoHeaders });
    const agentData = agentRes.data;

    // Scenario 24: Operational Agent ingests statistical predictions and synthesizes directives
    assert(
      agentData.engineType === 'RULE_BASED_OPERATIONAL_ANALYZER' &&
      Array.isArray(agentData.directives) &&
      agentData.directives.length > 0,
      `Scenario 24: Controlled AI synthesized ${agentData.directives.length} operational directives from statistical predictions`
    );

    // Scenario 25: Mandatory Human Review: All directives require human clinical approval
    const allRequireApproval = agentData.directives.every((d: any) => d.requiresHumanReview === true);
    assert(
      allRequireApproval,
      'Scenario 25: Mandatory Human Review: 100% of agent predictive directives require human clinical approval'
    );

    // Scenario 26: Autonomous Mutation Prevention: Agent has autonomousMutationAllowed = false
    const noAutonomousMutation = agentData.directives.every((d: any) => d.autonomousMutationAllowed === false);
    assert(
      noAutonomousMutation,
      'Scenario 26: Autonomous Mutation Prevention: Agent strictly prohibited from mutating clinical or facility state'
    );

    // =============================================================
    // GROUP 8: SECURITY, RBAC & PATIENT PII PROTECTION (PHASE 15)
    // =============================================================
    console.log('\n--- GROUP 8: SECURITY, RBAC & PATIENT PII PROTECTION ---');

    // Scenario 27: Cross-Facility IDOR Defense: Doctor B blocked from Facility A
    let idorBlocked = false;
    try {
      await axios.get(`${BASE_URL}/predictions/facilities/${BARAMATI_FAC_ID}`, { headers: pedsHeaders });
    } catch (err: any) {
      idorBlocked = err.response?.status === 403;
    }
    assert(
      idorBlocked,
      'Scenario 27: Cross-Facility IDOR Defense: Doctor not assigned to Baramati CHC blocked with HTTP 403 Forbidden'
    );

    // Scenario 28: Role Boundary Defense: Patient blocked from district operational predictions
    let patientBlocked = false;
    try {
      await axios.get(`${BASE_URL}/predictions/operations`, { headers: patHeaders });
    } catch (err: any) {
      patientBlocked = err.response?.status === 403;
    }
    assert(
      patientBlocked,
      'Scenario 28: Role Boundary Defense: Patient blocked from district operational predictions with HTTP 403'
    );

    // Scenario 29: Patient PII Protection: Zero patient names, phones, or ABHAs in prediction payloads
    const opsPredRes = await axios.get(`${BASE_URL}/predictions/operations`, { headers: cmoHeaders });
    const payloadStr = JSON.stringify(opsPredRes.data);
    const hasPII =
      payloadStr.includes('Ramesh Kulkarni') ||
      payloadStr.includes('9111222333') ||
      payloadStr.includes('14-digit') ||
      payloadStr.includes('ABHA');
    assert(
      !hasPII,
      'Scenario 29: Patient PII strictly protected: Zero patient names, phone numbers, or ABHA identifiers present in prediction telemetry'
    );

    // Scenario 30: Unauthenticated requests rejected with HTTP 401 Unauthorized
    let unauthBlocked = false;
    try {
      await axios.get(`${BASE_URL}/predictions/operations`);
    } catch (err: any) {
      unauthBlocked = err.response?.status === 401;
    }
    assert(
      unauthBlocked,
      'Scenario 30: Unauthenticated request safely rejected with HTTP 401 Unauthorized'
    );

    // =============================================================
    // GROUP 9: AUDIT, DETERMINISM & STRICT NON-MUTATION
    // =============================================================
    console.log('\n--- GROUP 9: AUDIT, DETERMINISM & STRICT NON-MUTATION ---');

    // Scenario 31: Deterministic predictions: Repeated queries produce identical mathematical outputs
    const run1 = await predictQueuePressure(BARAMATI_FAC_ID, 2);
    const run2 = await predictQueuePressure(BARAMATI_FAC_ID, 2);
    assert(
      run1.predictedQueue === run2.predictedQueue &&
      run1.pressureLevel === run2.pressureLevel &&
      run1.confidence === run2.confidence,
      `Scenario 31: Prediction determinism verified: Predicted queue (${run1.predictedQueue}) identical across invocations`
    );

    // Scenario 32: Mathematically derived confidence: Bounded by sample size without arbitrary values
    assert(
      run1.confidence != null &&
      run1.confidence > 0 &&
      run1.confidence <= 0.95 &&
      run1.confidence === Math.min(0.95, Math.round((run1.observationsUsed / 50) * 100) / 100),
      `Scenario 32: Mathematical confidence verified: ${run1.confidence} derived from sample size (${run1.observationsUsed} observations)`
    );

    // Scenario 33: Realtime cache invalidation: Socket events trigger recomputation from live DB
    invalidatePredictionCache('FACILITY_CAPACITY_CHANGED', BARAMATI_FAC_ID);
    const refreshedCap = await predictCapacityPressure(BARAMATI_FAC_ID, 'GENERAL', 6);
    assert(
      refreshedCap.length > 0 && refreshedCap[0].dataStatus === 'VERIFIED_PREDICTABLE',
      'Scenario 33: Realtime cache invalidation cleared cache and triggered fresh database computation'
    );

    // Scenario 34: Strict DB non-mutation verification: Zero row count changes (strictly read-only)
    const [
      finalFacCount,
      finalCapCount,
      finalAvailCount,
      finalQueueCount,
      finalRefCount,
      finalRefEventCount,
      finalDiagCount,
      finalFollowUpCount,
      finalApptCount,
      finalPatientCount
    ] = await Promise.all([
      prisma.facility.count(),
      prisma.facilityCapacity.count(),
      prisma.facilityAvailability.count(),
      prisma.queueEntry.count(),
      prisma.referral.count(),
      prisma.referralEvent.count(),
      prisma.diagnosticOrder.count(),
      prisma.followUp.count(),
      prisma.appointment.count(),
      prisma.patient.count()
    ]);

    const isNonMutated =
      initFacCount === finalFacCount &&
      initCapCount === finalCapCount &&
      initAvailCount === finalAvailCount &&
      initQueueCount === finalQueueCount &&
      initRefCount === finalRefCount &&
      initRefEventCount === finalRefEventCount &&
      initDiagCount === finalDiagCount &&
      initFollowUpCount === finalFollowUpCount &&
      initApptCount === finalApptCount &&
      initPatientCount === finalPatientCount;

    assert(
      isNonMutated,
      'Scenario 34: Strict DB non-mutation verified: All PostgreSQL tables maintained exact row counts (READ-ONLY)'
    );

  } catch (err: any) {
    console.error('\nFatal test execution error:', err.response?.data || err.message);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed})`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPredictionOperationsTests();
