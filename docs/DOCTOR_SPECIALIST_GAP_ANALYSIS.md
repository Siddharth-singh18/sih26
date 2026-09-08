# AYUSYNC — DOCTOR & SPECIALIST WORKFLOW GAP ANALYSIS
**SIH 2026 · Rural Healthcare Platform**
**Repository**: `/home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean`
**Date**: September 8, 2026
**Status**: Phase 1 Audit Complete — Waiting for Implementation Approval

---

## EXECUTIVE SUMMARY

A complete audit of the Doctor and Specialist workflow was conducted across backend models, live PostgreSQL 15.19 data, REST routes, controllers, middleware, Socket.io events, frontend pages/components, and test suites.

Both existing test suites (**Patient Workflow: 29/29 passed**, **ASHA Workflow: 31/31 passed**) were independently executed and verified against live PostgreSQL. The backend dev server (`localhost:5000`) and Vite frontend (`localhost:5173`) are running and healthy.

This document details the 9 required audit areas for Doctor and Specialist roles prior to any implementation changes.

---

## 1. WHAT ALREADY EXISTS (VERIFIED)

### A. Database Models & Schema
- **`Doctor` Model**: Linked 1:1 to `User`, has relations to `Specialist?`, `FacilityDoctor[]`, `Appointment[]`, and `QueueEntry[]`.
- **`Specialist` Model**: Extends `Doctor` 1:1 with `specialty` string (`Obstetrics & Gynecology`, `Pediatrics & Neonatal Care`, `Internal Medicine`).
- **`FacilityDoctor` Model**: Multi-facility junction mapping doctors to facilities (e.g. Baramati CHC, Aundh District Hospital Pune).
- **`Encounter` Model**: Represents clinical visits (`FIELD_VISIT`, `CLINIC_VISIT`, `EMERGENCY`) with relations to assessments, vitals, prescriptions, clinical observations.
- **`Prescription` Model**: Has `encounterId`, `medication`, `dosage`, `duration`, `instructions`.
- **`ClinicalObservation` Model**: Has `encounterId`, `note`, `provenance: DOCTOR_RECORDED`.
- **`Condition` Model**: Active/resolved chronic conditions linked to `Patient`.
- **`DiagnosticOrder` & `DiagnosticResult` Models**: Lab orders and abnormal flag tracking.
- **`Appointment` & `QueueEntry` Models**: Scheduling and live token waiting queue.
- **`Referral` & `CounterReferral` Models**: Facility referral routing and closed-loop follow-up directives.
- **`FollowUp` Model**: Structured tasks with due dates assigned to frontline workers.

### B. PostgreSQL Live State
- **Doctor 1 (CMO)**: `doc-rajesh-deshmukh` (`+919876543210`), Chief Medical Officer, Internal Medicine, Baramati CHC.
- **Doctor 2 (OBGYN Specialist)**: `doc-priya-kulkarni` (`+919876543211`), Specialist in Obstetrics & Gynecology, Baramati CHC & Aundh District Hospital Pune.
- **Doctor 3 (Pediatrician)**: `doc-anand-joshi` (`+919876543212`), Specialist in Pediatrics & Neonatal Care, Junnar Rural Hospital.
- **Role Permissions**: `DOCTOR` role in PostgreSQL has 16 permissions (`assessment.*`, `encounter.*`, `facility.*`, `patient.*`, `queue.*`, `referral.*`, `task.*`).

### C. Backend Endpoints
- `POST /api/auth/login`: Authenticates doctor credentials, derives `doctorId`, embeds `doctorId` in JWT token and user payload.
- `POST /api/queue`: Creates walk-in or scheduled queue entries.
- `GET /api/queue`: Lists active queue entries.
- `GET /api/queue/doctor/:doctorId`: Fetches queue entries assigned to a specific doctor.
- `PUT /api/queue/:id/status`: Updates queue status (`WAITING` -> `IN_CONSULTATION` -> `COMPLETED`).
- `POST /api/followups/counter-referral`: Closes referral loop, creates `CounterReferral`, sets referral to `COUNTER_REFERRED`, creates structured `FollowUp` tasks for ASHA workers, and emits Socket.io event.
- `POST /api/ai/triage`: Deterministic ICMR/WHO rule-based triage evaluating vitals, red flags, and clinical risk factors.
- `POST /api/ai/route`: Capability-based facility routing evaluating ICU capacity, level, and readiness scores.

---

## 2. WHAT IS PARTIALLY IMPLEMENTED (PARTIAL)

1. **Consultation Flow & Clinical Record Creation**:
   - Doctor can mark queue entry `IN_CONSULTATION` and complete it via `POST /api/followups/counter-referral`.
   - **Gap**: It does *not* create an `Encounter` record in PostgreSQL (`CLINIC_VISIT`), does *not* synchronize the linked `Appointment.status` to `COMPLETED`, does *not* create `ClinicalObservation` notes, and stores prescribed medications only as a plain text string in `FollowUp.notes` rather than rows in the `Prescription` table.
2. **Prescription Management**:
   - `Prescription` table exists, and `GET /api/patients/me/prescriptions` queries it.
   - **Gap**: There is no doctor endpoint or consultation hook to persist structured `Prescription` records during patient consultation.
3. **Queue Scoping & Filtering**:
   - `GET /api/queue/doctor/:doctorId` exists in backend.
   - **Gap**: Frontend `Queue.tsx` only calls `GET /api/queue` (returns all entries across the whole state of Maharashtra), with no filtering by doctor or facility.
4. **Referral Management**:
   - Referral creation and state transitions exist for health workers.
   - **Gap**: Doctors cannot create upward specialist referrals from the consultation screen, and specialists have no endpoint to list incoming referrals directed to their facility or specialty.
5. **Dashboard Analytics**:
   - `GET /api/analytics/dashboard` returns real queue counts and pending referral metrics.
   - **Gap**: `Dashboard.tsx` still has hardcoded `SEED_PATIENTS` and hardcoded clinic status tiles.

---

## 3. WHAT IS MISSING (NOT_IMPLEMENTED)

1. **Dedicated Doctor Profile & Scoping API**:
   - No `GET /api/doctor/me` or `/api/doctor/profile` endpoint returning logged-in doctor details, specialty, and assigned facilities.
   - No automatic facility-scoped or doctor-scoped queue fetch (`GET /api/doctor/queue`).
2. **Specialist Inbox & Triage View**:
   - No UI or API for specialists (OBGYN, Pediatrics) to filter referrals matching their specialty.
   - No specialist workflow to review referral clinical history and accept/schedule high-risk cases.
3. **Doctor-Initiated Specialist Referrals**:
   - Primary Medical Officers at CHC cannot refer a patient up to District/Tertiary specialists from `Queue.tsx` or `PatientProfile.tsx`.
4. **Diagnostic Ordering Workflow**:
   - No doctor UI to order laboratory diagnostics (HbA1c, CBC, USG, Creatinine, Lipid profile) during consultation.
   - Doctor cannot view patient diagnostic test history inside `Queue.tsx` or `PatientProfile.tsx`.
5. **Real-time Queue in Frontend**:
   - `useRealtimeQueue.ts` hook is built but never imported into `Queue.tsx`. Queue relies on manual page refresh.
6. **Automated Doctor Test Suite**:
   - Zero integration or E2E tests for the Doctor and Specialist workflows.

---

## 4. SCHEMA LIMITATIONS

1. **`DiagnosticOrder` Missing Relational Foreign Keys**:
   - `DiagnosticOrder` has only `id`, `testName`, `status`.
   - **Missing**: `patientId` (foreign key to `Patient`), `encounterId` (foreign key to `Encounter`), `doctorId` (who ordered it), and `orderedAt`.
   - *Impact*: Diagnostic orders cannot currently be relationally scoped to a patient in SQL; all orders are globally returned.
2. **`Encounter` Doctor Association**:
   - `Encounter` lacks a direct `doctorId` foreign key. Doctor association is currently only inferable through `Appointment` or `ClinicalObservation.provenance`.
3. **`Referral` Specialty Column**:
   - `Referral` has `originId` and `destinationId` (facilities), but lacks an explicit `specialty` or `targetSpecialistId` column (currently embedded in `reason` text).

---

## 5. SECURITY & AUTHORIZATION GAPS

1. **`GET /api/queue/doctor/:doctorId` IDOR**:
   - Route takes `doctorId` as URL param without verifying that the authenticated user owns that doctor ID or has administrative access.
2. **Missing `requireDoctor` Middleware**:
   - Unlike `requirePatient` and `requireWorker`, there is no `requireDoctor` helper in `backend/src/middleware/auth.ts`.
3. **Global Information Disclosure in `/api/diagnostics`**:
   - Without `patientId` filtering, `GET /api/diagnostics` returns all diagnostic tests across all patients.
4. **Unscoped `GET /api/queue`**:
   - Returns queue entries across all facilities without checking user facility assignment.

---

## 6. FRONTEND GAPS

1. **`Dashboard.tsx` Mock Data**:
   - Contains hardcoded `SEED_PATIENTS` array ("Pooja Sharma", "Aniket Gaikwad", "Ramesh Kulkarni").
   - Contains hardcoded clinic status tiles ("18 of 24 beds", "Oxygen Full", "Dr. Verma").
2. **Dead / Unused Components**:
   - `LiveQueue.tsx`: Contains static mock rows (`Rahul Kumar`, `Sita Devi`) and is never imported.
   - `CounterReferralForm.tsx`: Only logs to `console.log` and is never imported.
3. **No Specialist View**:
   - Dr. Priya Kulkarni (OBGYN) and Dr. Anand Joshi (Pediatrics) see the identical generic view with no specialty-specific referral or queue view.
4. **No Diagnostic Ordering in Consultation Modal**:
   - `CounterReferralModal` does not allow selecting or placing lab diagnostic orders.
5. **No Upward Referral in Consultation Modal**:
   - Doctors cannot escalate a patient to a higher facility or specialist.

---

## 7. TESTING GAPS

1. `backend/tests/referral.test.ts` is a trivial dictionary check with 0 database interaction.
2. Zero integration tests for Doctor login, queue management, IDOR protection, consultation completion, prescription generation, diagnostic order placement, and specialist referrals.

---

## 8. EXTERNAL INTEGRATION BLOCKERS

1. **ABDM Sandbox Gateway**: `interopAdapter.syncToGateway()` operates in sandbox emulation mode. Live gateway requires official ABDM sandbox client ID and secret (`BLOCKED_EXTERNAL`).
2. **SMS / Telephony**: SMS notifications require third-party SMS gateway credentials (`BLOCKED_EXTERNAL`). In-app notifications in PostgreSQL `Notification` table are fully functional.

---

## 9. RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Backend Doctor & Specialist Security & APIs
1. Add `requireDoctor` middleware in `backend/src/middleware/auth.ts`.
2. Add `GET /api/auth/doctor/me` returning doctor ID, user details, specialty, and facility assignments.
3. Update `GET /api/queue/doctor/:doctorId` with strict IDOR protection (`req.user.doctorId === doctorId || isAdmin`).
4. Add `GET /api/referrals` supporting filters (`destinationId`, `specialty`, `status`) so specialists can view incoming referrals.

### Phase 2: Consultation, Encounter, Prescription & Diagnostic Persistence
1. Update consultation completion (`POST /api/followups/counter-referral` or new consultation endpoint) to:
   - Create a real `Encounter` (`CLINIC_VISIT`, `status: COMPLETED`, `facilityId`).
   - Create real `Prescription` rows in PostgreSQL linked to the `Encounter`.
   - Update `Appointment.status` to `COMPLETED`.
   - Synchronize `QueueEntry.status` to `COMPLETED`.
   - Record `ClinicalObservation` notes with doctor provenance.
2. Update `DiagnosticOrder` creation/listing to link with patient and encounter context.
3. Allow doctor-initiated upward referrals (`POST /api/referrals`).

### Phase 3: Specialist Referral Lifecycle
1. Enable specialist doctors (OBGYN, Pediatrics) to accept, review, and schedule incoming referrals from frontline workers or primary doctors.
2. Ensure referral state transitions (`SUBMITTED` -> `ACCEPTED` -> `SCHEDULED` -> `IN_CONSULTATION` -> `COUNTER_REFERRED`) are logged in `ReferralEvent`.

### Phase 4: Frontend Doctor & Specialist UI/UX Polish
1. Clean up `Dashboard.tsx`: remove `SEED_PATIENTS` mock data; connect to live waiting queue and actual facility availability metrics.
2. Remove dead code (`LiveQueue.tsx`, `CounterReferralForm.tsx`).
3. Connect `useRealtimeQueue` WebSocket in `Queue.tsx` for live queue updates.
4. Enhance `Queue.tsx` with tabs: "My Consultation Queue", "Facility Queue", and "Specialist Referrals".
5. Enhance Consultation Modal with structured prescription writing, diagnostic ordering, and optional upward referral.
6. Display doctor specialty badge and facility context in header and profile.

### Phase 5: Automated Test Suite & Non-Regression Verification
1. Create `backend/tests/doctor_workflow.test.ts` covering authentication, queue scoping, consultation lifecycle, prescriptions, diagnostics, specialist referrals, and realtime updates.
2. Run `patient_workflow.test.ts` (29/29) and `asha_workflow.test.ts` (31/31) to guarantee zero regressions across existing functionality.
3. Verify backend and frontend builds and lint pass cleanly.
4. Produce `docs/DOCTOR_SPECIALIST_EVIDENCE_AUDIT.md`.
