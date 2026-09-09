# AYUSYNC — FACILITY & OPERATIONS INTELLIGENCE PHASE 4
## Realtime Operational Intelligence + Controlled AI/Agent Integration Evidence Audit

**Repository:** `/home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean`  
**Phase:** Facility & Operations Phase 4  
**Date:** 2026-09-08  
**Audit Verification Baseline:** 185 / 185 Integration Tests Passed (100% Green)

---

## 1. Executive Summary & Verification Matrix

Phase 4 establishes real-time operational telemetry and a controlled, human-in-the-loop operational AI agent across AyuSync. Sockets are cryptographically authenticated via JWT and strictly authorized against authentic domain relationships in PostgreSQL (`FacilityDoctor`, `Worker.facilityId`, and `ADMIN`). All real-time broadcasts originate strictly from committed database transactions (never synthetic ticks or periodic demo loops). Consequential operational agent recommendations mandate human confirmation via dedicated approval endpoints with full audit provenance.

### Status Classification Matrix
| Component / Capability | Status | Evidence / Audit Findings |
|---|---|---|
| Socket JWT Authentication | **VERIFIED** | Handshake middleware decodes JWT and binds identity to socket context. |
| Facility Room Authorization | **VERIFIED** | `join:facility` restricted to assigned Doctors, Workers, and Administrators. |
| Cross-Facility IDOR Defense | **VERIFIED** | Doctor B assigned to Junnar blocked from subscribing to Baramati room (403). |
| Nonexistent / Unauthenticated Room Defense | **VERIFIED** | Safely rejected without leaking internal network or data. |
| `FACILITY_AVAILABILITY_CHANGED` | **VERIFIED** | Emitted from `updateFacilityAvailability` only after DB transaction commits. |
| `FACILITY_CAPACITY_CHANGED` | **VERIFIED** | Emitted from `updateFacilityCapacity` with authentic `total`, `occupied`, `available`. |
| `QUEUE_LOAD_CHANGED` | **VERIFIED** | Emitted on enqueue, arrival, and consultation transition with live DB count. |
| `REFERRAL_OPERATIONAL_UPDATE` | **VERIFIED** | Broadcast to origin and destination facilities upon referral creation/transition. |
| `URGENT_ESCALATION` | **VERIFIED** | Dispatched to destination facility on `URGENT`/`EMERGENCY` priority referrals. |
| Notification Scoping & DB Delivery | **VERIFIED** | Notifications delivered to `user_${id}` private rooms and assigned doctors in DB. |
| Controlled Operational AI Agent | **VERIFIED** | Deterministic `RULE_BASED_OPERATIONAL_ANALYZER` with zero autonomous clinical mutations. |
| Human Approval Gates | **VERIFIED** | Dedicated approve, reject, and modify endpoints with mandatory human gate. |
| AI Provenance Tracking | **VERIFIED** | Source event, engine type, rationale, and decision actor persisted in `AuditLog`. |
| Frontend Realtime Invalidation | **VERIFIED** | `FacilityReadiness.tsx` reacts dynamically to socket events by refetching PostgreSQL telemetry. |
| No-Mock Compliance | **VERIFIED** | Class C = 0, Class D = 0. Zero `Math.random` or fake data in runtime business logic. |
| SMS Delivery | **BLOCKED_EXTERNAL** | No external telecom SMS gateway configured in local offline sandbox. |
| External LLM Microservice | **BLOCKED_EXTERNAL** | Python microservice proxy marks external LLM calls blocked, falling back safely to deterministic rules. |

---

## 2. Realtime Architecture & Room Security Model

### Socket Transport & Connection Lifecycle
1. **Server Initialization**: Mounted in `backend/src/events/socket.ts` using `initSocket(httpServer)`.
2. **Authentication Middleware**:
   ```ts
   io.use(async (socket: Socket, next) => {
     const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
     if (rawToken) {
       const user = await authenticateSocketToken(rawToken);
       if (user) socket.data.user = user;
     }
     return next();
   });
   ```
3. **Private User Room Auto-Join**:
   Upon authenticated connection, the socket automatically joins:
   - `user_${user.id}` (personal notification room)
   - `worker_${user.workerId}` (if health worker)
   - `doctor_${user.doctorId}` (if doctor)
   - `patient_${user.patientId}` (if patient)

### Domain-Based Facility Room Authorization (`join:facility`)
When a client requests `socket.emit('join:facility', facilityId, callback)`:
1. **Unauthenticated Check**: If `!socket.data.user`, rejects immediately with `401 Unauthorized`.
2. **Facility Existence Check**: Queries PostgreSQL `prisma.facility.findUnique({ where: { id: facilityId } })`. If absent, rejects with `404 Not Found`.
3. **Authorization Check**:
   - **Administrator (`ADMIN`)**: Authorized across all district facilities.
   - **Doctor (`DOCTOR`)**: Verified against PostgreSQL `FacilityDoctor` join table:
     ```ts
     const assignment = await prisma.facilityDoctor.findUnique({
       where: { facilityId_doctorId: { facilityId, doctorId: user.doctorId } }
     });
     ```
   - **Frontline Worker (`ASHA`)**: Verified against PostgreSQL `Worker.facilityId === facilityId`.
   - **Other Users / Unassigned**: Safely rejected with `403 Forbidden` (`Forbidden: You are not assigned to this facility`).

---

## 3. Real-Time Operational Event Catalog

Every event payload follows the safe, database-backed standard structure without leaking sensitive patient PII into facility broadcast channels:

```json
{
  "event": "EVENT_NAME",
  "facilityId": "fac-baramati-chc",
  "timestamp": "2026-09-08T18:19:13.568Z",
  "entityId": "uuid-or-id",
  "summary": "Human-readable clinical operational summary",
  "data": { ... }
}
```

### Event Specifications
1. **`FACILITY_AVAILABILITY_CHANGED`**:
   - **Trigger**: Committed transaction in `updateFacilityAvailability` (`facility.controller.ts`).
   - **Data**: `{ facilityId, status, readinessScore, updatedAt }`.
   - **Room**: `facility_${facilityId}`.
2. **`FACILITY_CAPACITY_CHANGED`**:
   - **Trigger**: Committed transaction in `updateFacilityCapacity` (`facility.controller.ts`).
   - **Data**: `{ facilityId, capacityId, category, total, occupied, available, updatedAt }`.
   - **Room**: `facility_${facilityId}`.
3. **`QUEUE_LOAD_CHANGED`**:
   - **Trigger**: Committed `QueueEntry` creation, arrival token issuance, or status transition.
   - **Data**: `{ facilityId, activeQueueCount, queueLoad, lastAction, entryId, status }`.
   - **Rooms**: `facility_${facilityId}` and `doctor_${doctorId}`.
4. **`REFERRAL_OPERATIONAL_UPDATE`**:
   - **Trigger**: Committed `Referral` creation or state transition (`referral.controller.ts`).
   - **Data**: `{ referralId, originId, destinationId, status, urgency, reason }`.
   - **Rooms**: `facility_${originId}` and `facility_${destinationId}`.
5. **`URGENT_ESCALATION`**:
   - **Trigger**: Referral created with `urgency: 'URGENT' | 'EMERGENCY'`.
   - **Data**: `{ escalationType: 'REFERRAL_URGENT', facilityId, entityId, urgency, reason }`.
   - **Room**: `facility_${destinationId}` + PostgreSQL `Notification` inserted for assigned facility doctors.

---

## 4. Controlled Operational Intelligence Agent (Part J, K & O)

### Architecture & Ethical Safety Guardrails
The operational agent in `backend/src/modules/ai/operational_agent.service.ts` provides intelligent operational decision support while enforcing strict clinical boundaries:
- **PROHIBITED ACTIONS**: The agent will NEVER autonomously diagnose patients, prescribe medicines, alter clinical vitals/records, or bypass human review.
- **PERMITTED ACTIONS**: The agent analyzes capacity exhaustion, queue delays, and urgent referral backlogs to formulate operational recommendations.
- **ENGINE CLASSIFICATION**: Transparently designated as `RULE_BASED_OPERATIONAL_ANALYZER`. Honest heuristic CDSS, never deceptively labeled as "autonomous LLM".
- **HUMAN APPROVAL GATE**: Consequential mutations (such as changing facility availability to `OVERCAPACITY`) are staged in a `PENDING_APPROVAL` state. An authorized Doctor or Administrator must review and approve or reject before any database update occurs.

### Agent Workflow Lifecycle
```
REAL OPERATIONAL EVENT (e.g. ICU Exhaustion)
        ↓
Event Normalization
        ↓
PostgreSQL Context Retrieval (Bed tallies, active queue count, assigned doctors)
        ↓
Deterministic Risk Classification (CRITICAL / HIGH / MEDIUM / LOW)
        ↓
Formulate Recommendation (Target entity, proposed change, clinical rationale)
        ↓
Staged in PENDING_APPROVAL state + DB Task created + Doctor alerted
        ↓
Human Approval Gate (/api/ai/agent/recommendations/:id/approve | reject | modify)
        ↓
[APPROVED] Mutates DB transactionally, writes AuditLog, emits realtime event
[REJECTED] Aborts mutation, records AGENT_ACTION_REJECTED in AuditLog
```

### Full Provenance Logged in `AuditLog`
Every recommendation and human decision writes immutable provenance:
- Action: `AGENT_RECOMMENDATION_GENERATED`, `AGENT_ACTION_APPROVED`, `AGENT_ACTION_REJECTED`, `AGENT_ACTION_MODIFIED`
- Resource: `OperationalIntelligenceAgent` / `FacilityAvailability`
- Context: Real facility ID, user ID of approving/rejecting doctor, timestamp, and truthful confidence (`1.0` for deterministic rule satisfaction).

---

## 5. Frontend Reactive Synchronization (`web/src/pages/FacilityReadiness.tsx`)

1. **REST Initial Load**: Fetches baseline facility telemetry from `/api/facilities` on mount.
2. **Socket Subscriptions**: Authenticates with `ayusync_token` and subscribes to authorized facility rooms.
3. **Event Invalidation**:
   - Upon receiving `FACILITY_AVAILABILITY_CHANGED`, `FACILITY_CAPACITY_CHANGED`, or `QUEUE_LOAD_CHANGED`, the UI invalidates cached telemetry and calls `fetchFacilities()` against PostgreSQL.
   - Sockets act as the *signaling vehicle*; PostgreSQL remains the *single source of truth*.
4. **Urgent Alerts**: `URGENT_ESCALATION` events display a persistent, non-intrusive alert banner directly on the facility operations console without disrupting active doctor workflows.

---

## 6. No-Mock Verification Audit (Part P)

A comprehensive codebase audit was executed to ensure zero runtime mocks or hardcoded data:
- **`Math.random` search in `backend/src`**: **0 occurrences**.
- **`mock` / `fake` in `backend/src` business logic**: **0 occurrences**.
- **Classification**:
  - Class A (Legitimate UI placeholder/test fixtures): Test assertions in isolated test files.
  - Class B (External sandbox adapter): Node-cron background jobs and PostgreSQL connectors.
  - Class C (Runtime mock/fallback): **0 occurrences**.
  - Class D (Suspicious hardcoded business data): **0 occurrences**.

---

## 7. Test Suite Execution & Full Regression Baseline

All 7 integration test suites passed with 100% success against PostgreSQL:

```bash
npx ts-node tests/facility_realtime.test.ts      # 30 / 30 PASSED
npx ts-node tests/facility_routing.test.ts       # 38 / 38 PASSED
npx ts-node tests/facility_operations.test.ts    # 22 / 22 PASSED
npx ts-node tests/doctor_workflow.test.ts        # 31 / 31 PASSED
npx ts-node tests/asha_workflow.test.ts          # 31 / 31 PASSED
npx ts-node tests/patient_workflow.test.ts       # 29 / 29 PASSED
npx ts-node tests/referral.test.ts               #  4 /  4 PASSED
-------------------------------------------------------------
TOTAL GRAND TOTAL:                             185 / 185 PASSED (100%)
```

### Build & Lint Verification
- **Backend Build (`tsc`)**: Clean compile in 1.98s, **0 errors**.
- **Frontend Build (`vite build`)**: Clean production bundle in 2.13s, **0 errors**.
- **Frontend Lint (`eslint`)**: Clean report, **0 errors, 0 warnings**.

---

## 8. SIH Alignment & Mapping

| SIH Problem Statement Requirement | AyuSync Implementation | Evidence |
|---|---|---|
| Dynamic Bed & Resource Tracking | Real PostgreSQL `FacilityCapacity` mutations with transactional `AuditLog` | Scenarios 10-13, `facility_realtime.test.ts` |
| Real-time Facility Readiness | WebSocket event propagation of availability, readiness score, and bed counts | Scenarios 10, 12, `facility_realtime.test.ts` |
| Emergency & High-Acuity Escalation | Urgent referral routing with real-time escalation and doctor notification | Scenarios 16-19, `facility_realtime.test.ts` |
| Closed-Loop Doctor & ASHA Coordination | Counter-referrals, follow-up scheduling, and live queue token updates | Scenarios 14-15, 25-28 (`asha_workflow.test.ts`) |
| Explainable & Safe Healthcare AI | Human-in-the-loop operational agent with approval gates and complete audit trails | Scenarios 23-28, `facility_realtime.test.ts` |
| Robust Data Security & RBAC | Strict room authorization, cross-facility IDOR rejection, and PII protection | Scenarios 1-9, 20-22, `facility_realtime.test.ts` |

