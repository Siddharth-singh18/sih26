# AyuSync — Frontline Health Worker (ASHA) Comprehensive System Audit

**Target Repository:** `/home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean`  
**Focus:** ASHA / Frontline Community Health Worker Workflow (`WorkerDashboard`, `PatientIntakeFlow`, `CareGaps`, `SyncCenter`, and Associated Backend Services)  
**Audit Date:** September 8, 2026  
**Auditor:** AyuSync Advanced Clinical Engineering Agent  

---

## 1. Executive Summary

A comprehensive, deep-architecture audit of the ASHA / Frontline Health Worker implementation was conducted across the backend modules (`workers`, `tasks`, `patients`, `assessments`, `encounters`, `vitals`, `referrals`, `followups`, `sync`, `ai`, `notifications`), Prisma models, and web frontend components.

While foundational models (`Worker`, `Encounter`, `Assessment`, `Vital`, `Referral`, `CounterReferral`, `FollowUp`, `SyncOperation`) exist in PostgreSQL 15.19, the active ASHA worker runtime exhibits **critical functional gaps, hardcoded mock fallbacks, broken RBAC scoping, and disconnected clinical encounter persistence**.

Specifically:
1. **Hardcoded Mock Fallbacks in Runtime**:
   - `DEMO_WORKER_TASKS` and `DEMO_WORKER_PATIENTS` hardcoded in `WorkerDashboard.tsx`.
   - `DEMO_SEED_FOLLOWUPS` in `followup.controller.ts`.
   - `DEMO_TASKS` in `CareGaps.tsx`.
   - `DEMO_PATIENTS` in `Patients.tsx`.
   - `SyncCenter.tsx` contains a 100% static mock conflict screen.
2. **Disconnected Clinical Encounter Flow**:
   - `PatientIntakeFlow.tsx` does not call `POST /api/patients/encounter` or `POST /api/assessments` with structured vitals and symptoms. Instead, it generates random referral tokens (`Math.random`), random fake ABHA IDs, and creates a disconnected referral directly.
3. **RBAC & IDOR Vulnerabilities**:
   - `auth.ts` does not dynamically attach `workerId` to `req.user` for worker tokens.
   - `listFollowUps` in `followup.controller.ts` checks `user?.role === 'WORKER'` while `user.roles` is an array, allowing workers to access all tasks across the entire district instead of their assigned tasks.
   - `completeFollowUp` does not verify that the updating worker owns the follow-up task.
   - `seed.ts` assigned `queue.manage` permission to `WORKER`, which would permit workers to alter doctor consultation queues.
4. **Offline Sync Disconnect**:
   - `WorkerDashboard.tsx` uses `localStorage` instead of Dexie (`AyuSyncDB`), while `useSync.ts` uses Dexie. The two mechanisms are completely disjoint.
5. **AI Recommendation & Human Approval Loop**:
   - Although `AIRecommendation` has `humanConfirmed` and `overrideReason`, there is no API endpoint or UI for frontline workers to review, accept, modify, or reject AI decision support recommendations.

---

## 2. Comprehensive Inventory & Defect Classification

| Phase / Component | Existing State | Classification | Root Cause & Technical Details | Required Remediation |
|---|---|---|---|---|
| **Phase 1: Architecture Baseline** | Models exist in `schema.prisma`. Backend modules exist in `backend/src/modules`. | **PARTIAL** | Schemas are structurally sound, but endpoints bypass models or inject fake mocks. | Audit completed; blueprint migration plan. |
| **Phase 2: Identity & RBAC** | `User` -> `Role` -> `Permission`. `Worker` model linked to `User`. | **BROKEN** | `auth.ts` fails to populate `workerId` on `req.user`. `listFollowUps` worker filter fails. Worker granted `queue.manage`. | Attach `workerId` in `authenticate`. Remove `queue.manage` from `WORKER`. Enforce strict ownership on task queries and completions (403/404). |
| **Phase 3: Patient Discovery** | `GET /api/patients/search?q=` searches name, phone, identifier. | **PARTIAL** | Does not search village. `Patients.tsx` falls back to `DEMO_PATIENTS` on empty search. | Add `village` search. Eliminate `DEMO_PATIENTS` from `Patients.tsx`. Connect directly to shared Patient record. |
| **Phase 4: Assisted Registration** | `POST /api/patients` creates patient in DB. | **BROKEN / MOCKED** | No duplicate phone check. `PatientIntakeFlow.tsx` creates fake `ABHA` IDs and fake phones. | Enforce phone conflict validation. Prevent fake ABHA generation; represent missing ABHA as null/pending. |
| **Phase 5: Home / Village Visit** | `Encounter` model supports `FIELD_VISIT`. | **BROKEN / MISSING** | `PatientIntakeFlow.tsx` completely skips creating an `Encounter`. Clinical records stored only in UI state. | Create real `Encounter` in PostgreSQL (`FIELD_VISIT`, `IN_PROGRESS`), link assessment, vitals, observations, and outcome. |
| **Phase 6: Vitals Recording** | `Vital` model supports `BP`, `HR`, `TEMP`, `SPO2`. `validateVitals` exists. | **PARTIAL** | `Vital` table lacks standard storage for Blood Glucose, Respiratory Rate, Weight. Vitals bypassed during intake. | Enhance `validateVitals` (reject SpO2 > 100). Store structured vitals linked to `Encounter`. Connect intake flow to vitals. |
| **Phase 7: Structured Symptoms** | `Symptom` and `Assessment` models exist with severity and duration. | **PARTIAL** | Intake flow sends symptoms as a flat comma-separated string to referrals, bypassing `Assessment` and `Symptom`. | Persist structured symptoms in `Assessment` with severity (`MILD`, `MODERATE`, `SEVERE`) and duration. |
| **Phase 8: High-Risk Identification** | Heuristic rules in `ai.controller.ts` flag urgent cases. | **PARTIAL** | Rules use diagnostic language instead of clinical decision support ("urgent review recommended"). | Refactor to explainable triage categories (Maternal, Child, Chronic, Severe Vitals) with non-diagnostic language. |
| **Phase 9: AI Triage Decision Support** | `POST /api/ai/triage` evaluates vitals and symptoms. | **PARTIAL** | Lacks clear "Clinical Decision Support — Requires Human Confirmation" indicator and provenance tracking. | Add explicit decision support metadata, confidence score, and confirmation requirements. |
| **Phase 10: Human Approval of AI** | `AIRecommendation` model has `humanConfirmed` and `overrideReason`. | **MISSING** | No API route or UI exists to accept, modify, or reject recommendations. | Implement `PATCH /api/assessments/:id/triage/confirm` with audit trail (workerId, timestamp, decision, reason). |
| **Phase 11: Referral Creation** | `POST /api/referrals` creates `Referral` and `ReferralEvent`. | **PARTIAL** | Frontend hardcodes `originId: fac-khandala-phc` and generates fake tokens using `Math.random`. | Derive origin facility from worker's assigned facility in PostgreSQL. Generate real database IDs. |
| **Phase 12: Intelligent Facility Routing** | `routing.service.ts` scores facilities by readiness and service. | **PARTIAL / MOCKED** | `ai.controller.ts` has hardcoded fallback facilities with fake IDs. `routing.service.ts` is not invoked. | Integrate `routing.service.ts` with real PostgreSQL facilities, services, and operational availability. |
| **Phase 13: Referral Tracking** | `VALID_TRANSITIONS` enforced. `ReferralEvent` records history. | **VERIFIED** | State machine correctly enforces valid transitions. | Maintain and verify through end-to-end testing. |
| **Phase 14: Counter-Referral Loop** | `POST /api/followups/counter-referral` creates counter-referral & tasks. | **PARTIAL / MOCKED** | `followup.controller.ts` falls back to `DEMO_SEED_FOLLOWUPS` if DB is empty. | Remove `DEMO_SEED_FOLLOWUPS`. Return authentic PostgreSQL records. |
| **Phase 15: Care-Gap / Follow-up Tasks** | `FollowUp` model supports `OVERDUE`, `PENDING`, `COMPLETED`. | **PARTIAL / MOCKED** | `WorkerDashboard.tsx` and `CareGaps.tsx` initialize state with static demo tasks. | Sourced 100% from PostgreSQL. Filter by worker assignments. Order by `OVERDUE`, `DUE TODAY`, `UPCOMING`. |
| **Phase 16: Maternal / Child / Chronic** | Represented via `Condition` and `FollowUp` reasons. | **PARTIAL** | No dedicated specialized clinical registries exist in Prisma schema. | Mark as PARTIAL per prompt instruction without fabricating unsupported schema models. |
| **Phase 17 & 18: Offline Sync & Conflicts** | Dexie schema in `db.ts`, `useSync.ts`, `SyncOperation` in Prisma. | **PARTIAL / MOCKED** | `WorkerDashboard.tsx` bypassed Dexie with `localStorage`. `SyncCenter.tsx` has static mock conflict. | Unify offline queue in Dexie. Expose real conflict resolution via `resolveSyncConflict`. Display LOCAL / PENDING / SYNCED / CONFLICT. |
| **Phase 19: Realtime Orchestration** | `join:worker` room exists in `socket.ts`. `counter_referral:created` event. | **PARTIAL** | Task completion and urgent care gap assignments do not broadcast to worker room. | Add worker room broadcast for new tasks and follow-up updates. |
| **Phase 20: Real Notifications** | `Notification` model in PostgreSQL. `POST /api/notifications`. | **PARTIAL** | Has `inMemoryNotifications` array fallback. | Remove in-memory fallback. Ensure notifications query PostgreSQL directly. |
| **Phase 21 & 22: Dashboard UX & Mobile** | `WorkerDashboard.tsx` has basic cards. | **PARTIAL / MOCKED** | Cluttered with demo state. Lacks task-first mobile hierarchy (360px-414px). | Redesign to: Today's Priorities (Overdue, Urgent, Due Today), My Patients, Active Referrals, Sync Status, Activity. |
| **Phase 23: Multilingual Readiness** | `LocalizationContext.tsx` exists. | **PARTIAL** | UI text is mostly hardcoded in English. | Structure labels cleanly for localization without claiming full multilingual completion. |
| **Phase 24: Security & IDOR** | RBAC middleware exists. | **BROKEN** | Workers can access tasks assigned to other workers due to faulty `role` check in `listFollowUps`. | Enforce workerId scoping and verify 403/404 on manipulated IDs. |
| **Phase 25: No-Mock Compliance** | Widespread runtime demo mocks in `followup.controller.ts`, `WorkerDashboard.tsx`, `CareGaps.tsx`, `Patients.tsx`. | **MOCKED** | Demo fallback arrays mask missing data or API failures. | Eradicate all runtime mocks. Retain test data only in `seed.ts` and test suites. |

---

## 3. Detailed Architectural Defect Analysis

### A. RBAC & Worker Identity Resolution Defect
`auth.ts` lines 45-73 extracts `patientId` by phone matching, but completely ignores `workerId`:
```typescript
// CURRENT BUG: req.user has no workerId
req.user = {
  id: user.id,
  roles,
  permissions,
  patientId,
  phone: user.phone || undefined
};
```
In `followup.controller.ts` line 272:
```typescript
// CURRENT BUG: user.role is undefined because req.user has roles: string[]
if (user?.role === 'WORKER') {
  const worker = await prisma.worker.findUnique({ where: { userId: user.id } });
  if (worker) where.workerId = worker.id;
}
```
Because `user.role` is undefined, the filter `where.workerId = worker.id` is never applied. ASHA worker Sunita Patil sees all follow-ups in the database, including tasks assigned to other workers. Furthermore, `completeFollowUp` does not verify that the worker attempting completion is assigned to the task.

### B. Broken Clinical Encounter & Intake Pipeline
In `PatientIntakeFlow.tsx`:
1. The user enters name, age, phone, vitals, and symptoms.
2. If offline, it puts a random JSON into `localStorage` with `Math.random()` phone and fake ABHA ID.
3. If online, it calls `POST /api/patients`, then directly calls `POST /api/referrals`.
4. It **never calls** `POST /api/patients/encounter` to create an Encounter.
5. It **never calls** `POST /api/assessments` to persist the structured symptoms and vitals.
6. As a result, doctor and patient timelines have no record of the field visit encounter, symptoms, or recorded vitals!

### C. Runtime Mock Pollution
Multiple frontend and backend files contain fallback static objects that render when the database has zero records:
- `followup.controller.ts`: `DEMO_SEED_FOLLOWUPS`
- `WorkerDashboard.tsx`: `DEMO_WORKER_TASKS`, `DEMO_WORKER_PATIENTS`
- `CareGaps.tsx`: `DEMO_TASKS`
- `Patients.tsx`: `DEMO_PATIENTS`
- `SyncCenter.tsx`: Static mock conflict layout
This violates Phase 25 ("Remove runtime business mocks... Not allowed: runtime fake patients, runtime fake tasks, runtime fake vitals, runtime fake referrals").

---

## 4. Action Plan for Phase 2 – Phase 31 Execution

1. **Security & Identity Foundation**:
   - Update `auth.ts` to resolve and attach `workerId` and `doctorId` to `req.user`.
   - Update `seed.ts` and roles so `WORKER` does not have `queue.manage` permission.
   - Enforce strict ownership check on `listFollowUps` and `completeFollowUp` (ASHA A cannot read/modify ASHA B private tasks; return 403/404).
2. **Clinical Encounter & Assessment Pipeline**:
   - Refactor intake and home visit workflow to create a real `Encounter` in PostgreSQL (`FIELD_VISIT`, `IN_PROGRESS`).
   - Call `POST /api/assessments` to persist structured symptoms, validated vitals (BP, HR, Temp, SpO2, Blood Glucose), and clinical provenance.
   - Implement Human Approval endpoint: `PATCH /api/assessments/:id/triage/confirm` for Accept/Modify/Reject of AI recommendations.
3. **Eradicate All Runtime Mocks**:
   - Strip `DEMO_SEED_FOLLOWUPS` from backend.
   - Strip `DEMO_WORKER_TASKS`, `DEMO_WORKER_PATIENTS`, `DEMO_TASKS`, `DEMO_PATIENTS` from frontend.
   - Replace static `SyncCenter.tsx` with live Dexie/server conflict state.
4. **Intelligent Facility Routing**:
   - Connect referral creation to real PostgreSQL facilities and capabilities via `routing.service.ts`.
5. **Mobile-First ASHA Dashboard**:
   - Redesign `WorkerDashboard.tsx` to prioritize:
     - Today's Priorities (Overdue, Urgent, Due Today)
     - My Patients (Search + Village filter + quick intake)
     - Active Referrals & Counter-Referrals
     - Offline Sync Status
     - Recent Clinical Activity
6. **Automated Comprehensive Test Suite**:
   - Build `backend/tests/asha_workflow.test.ts` verifying all 25+ scenarios including ASHA login, patient search, encounter creation, vitals validation, explainable triage, human confirmation, referral routing, counter-referral loop, care-gap completion, offline sync, and IDOR protection.
