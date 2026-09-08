# AyuSync Clean Repository Audit

## 1. Repository
- **Directory Path**: `/home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean`
- **HEAD SHA**: `03c37dda50ca4b3ee152fc31568d4f8cbbdafc98`
- **Current Branch**: `main`
- **Remote URL**: `https://github.com/Naman354/AyuSync.git`
- **Working Tree**: Completely clean (`nothing to commit, working tree clean`)
- **Latest Commit**: `03c37dd AI features`
- **Original Working Tree (`/home/.../AyuSync`)**: Preserved untouched.

---

## 2. Architecture
The project follows a multi-service monorepo structure:
- `backend/`: Node.js + TypeScript + Express + Socket.IO REST and realtime backend.
- `web/`: React 18 + Vite + TailwindCSS + Dexie PWA for clinics and district dashboards.
- `app/`: Flutter (Dart >=3.2.0) mobile application for offline frontline ASHA/ANM workers.
- `ai-service/`: Python 3.10 + FastAPI microservice for rule-heuristic triage and facility routing.
- `docs/`: Technical matrices and audit reports.
- `docker-compose.yml`: Local multi-container definitions (PostgreSQL 15, Redis 7, backend, AI service).
- `render.yaml`: Production infrastructure definition for Render web services.

---

## 3. Technology Stack

### Backend
- **Framework**: Express 4.18.3
- **Language & Runtime**: TypeScript 5.3.3, Node.js v22.23.2
- **Package Manager**: npm 10.9.8
- **ORM**: Prisma 5.10.2 / 5.22.0
- **Database**: PostgreSQL 15.19
- **Authentication**: JWT (`jsonwebtoken` 9.0.3) + `bcrypt` 6.0.0
- **Realtime**: Socket.IO 4.7.4
- **Cache/Queue**: `ioredis` 5.3.2 (with automatic standalone in-memory fallback)
- **Validation**: Manual schema checking & request sanitization in controllers
- **Testing**: Jest/ts-node scratch scripts (`test_phase_*.js`)

### Frontend (`web/`)
- **Framework**: React 18.2.0
- **Language**: TypeScript 5.2.2
- **Build Tool**: Vite 5.1.4
- **Routing**: React Router DOM 7.18.3
- **API Client**: Axios 1.6.7
- **Styling**: TailwindCSS 3.4.1 + Lucide React icons
- **Offline Storage**: Dexie 4.4.5 (IndexedDB wrapper)
- **Realtime**: `socket.io-client` 4.7.4

### Mobile (`app/`)
- **Framework**: Flutter (SDK >=3.2.0 <4.0.0), Dart
- **Local DB**: `sqflite` 2.3.0
- **State**: `provider` 6.1.1
- **Networking**: `http` 1.2.0, `connectivity_plus` 6.1.5

### AI Microservice (`ai-service/`)
- **Framework**: FastAPI 0.110.0, Uvicorn 0.27.1, Pydantic 2.6.3
- **Language**: Python 3.10+
- **Architecture**: Heuristic-based triage and ranking simulator (no active deep learning/LLM weights loaded).

### Infrastructure
- **PostgreSQL**: Version 15.19 inside Docker container `ayusync-postgres-1`
- **Redis**: Alpine image in docker-compose, optional in local dev
- **Cloud Deployment**: Render (`render.yaml`) + Vercel (`vercel.json`)

---

## 4. Environment
Inspection of `process.env`, `import.meta.env`, `.env.example`, and source code:

| Variable | Used By | Required? | Secret? | Default In Code | Configured In Clean Repo? |
|---|---|---|---|---|---|
| `PORT` | Backend | No | No | `5000` | No (`.env.example` only) |
| `NODE_ENV` | Backend | No | No | `development` | No |
| `DATABASE_URL` | Backend / Prisma | **Yes** | Yes | None (Throws P1012 if missing) | No |
| `DIRECT_URL` | Backend / Prisma | **Yes** | Yes | None (Throws P1012 if missing) | No |
| `JWT_SECRET` | Backend Auth | No | Yes | `'ayusync_super_secret'` | No |
| `CORS_ORIGINS` | Backend CORS | No | No | Localhost regex auto-allowed | No |
| `REDIS_URL` | Backend Cache | No | Yes | Standalone fallback | No |
| `AI_SERVICE_URL` | Backend AI Proxy | No | No | `'http://localhost:8000'` | No |
| `VITE_API_URL` | Frontend API Client | **Yes** | No | `''` (Falls back to `window.location.origin`) | No |

### Critical Frontend URL Finding
In `web/src/lib/api.ts`:
```ts
const rawUrl = (import.meta.env.VITE_API_URL || '').trim();
export const getBaseServerUrl = (): string => {
  if (!rawUrl) return typeof window !== 'undefined' ? window.location.origin : '';
  return rawUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
};
export const getApiBaseUrl = (): string => {
  const base = getBaseServerUrl();
  return base ? `${base}/api` : '/api';
};
```
In `web/vite.config.ts`, **no proxy is configured**.
Therefore, if `VITE_API_URL` is omitted, the browser makes requests to `http://localhost:5173/api/...` which results in a 404 / HTML error.
The repository uses **Option A**: `VITE_API_URL=http://localhost:5000` is strictly required in `web/.env`.

---

## 5. PostgreSQL
- **Container**: `ayusync-postgres-1` (`postgres:15-alpine`), port 5432 mapped to host.
- **Server Version**: `PostgreSQL 15.19 on x86_64-pc-linux-musl`.
- **Database Status**: `ayusync` database exists and is active.
- **Roles**: `postgres` (Superuser). User `ayusync` has not yet been provisioned.
- **Network Note**: Connecting to port 5432 from within sandboxed shell sessions requires unsandboxed host bridge access (`BypassSandbox: true`).

---

## 6. Prisma
- **Schema Location**: `backend/prisma/schema.prisma`
- **Validation**: Schema is valid when `DATABASE_URL` and `DIRECT_URL` are provided.
- **Models Count**: 37 models spanning Identity, Clinical, Facility, Workflow, Referral, AI, and Audit domains.
- **Migrations Directory**: `backend/prisma/migrations/20260901184019_init/migration.sql`
- **Migration Status**: Verified via `prisma migrate status`:
  - `1 migration found in prisma/migrations`
  - `Database schema is up to date!`
  - 0 pending migrations, 0 migration errors.

---

## 7. Seed
- **Script**: `backend/prisma/seed.ts`
- **Execution Mechanism**: `npm run seed` (`ts-node prisma/seed.ts`)
- **Entities Seeded**:
  - Roles: `DOCTOR`, `WORKER`, `PATIENT`
  - Permissions: 16 permissions mapped to `DOCTOR` and `WORKER`.
  - Facilities: 5 Maharashtra healthcare facilities (Baramati CHC, Pune District Hospital, Khandala PHC, Saswad PHC, Junnar CHC).
  - Users & Profiles:
    - 3 Doctors (`+919876543210`, `+919876543211`, `+919876543212`)
    - 3 Frontline Workers (`+919998887776`, `+919998887777`, `+919998887778`)
    - 5 Patient user accounts (`+919111222333` to `+919111222337`)
    - 12 Patient domain clinical profiles with ABHA IDs and conditions.
  - Transactions: 5 Encounters with Vitals & Symptoms, 4 Referrals, 1 Counter-referral, 5 Appointments & Queue entries, 5 Follow-ups, 3 Tasks, 4 Notifications.
- **Password Hashing**: BCrypt 10 rounds (`bcrypt.hash('password123', 10)`).
- **Idempotency**: Deletes child and parent records via `deleteMany()` before recreation.
- **Flaw / Security Exposure**: `backend/prisma/seed.ts:7` contains a hardcoded fallback Supabase database URL with plaintext pooler credentials.
- **Permission Gap**: `patientRole` is created with NO permissions attached (`patient.read` is missing), which prevents patient accounts from querying their own timeline.

---

## 8. Authentication
- **Login Endpoint**: `POST /api/auth/login`
- **Doctor Discovery**: `GET /api/auth/doctors` (authenticated)
- **Logout Endpoint**: MISSING on backend (handled purely by client clearing localStorage).
- **Input Payload**: `{ "phone": string, "password": string }`
- **Phone Normalization**: Strips dashes/spaces, queries variants (`+91...`, 10 digits, etc.).
- **Password Verification**: `bcrypt.compare(password, user.password)` against PostgreSQL `User` record.
- **Token Generation**: 24h JWT containing `{ id, role, phone }`.
- **Identity Linkage**:
  - If role is `PATIENT`, queries `prisma.patient.findFirst` by phone number and returns `{ patientId, name }`.
  - If role is `DOCTOR` or `WORKER`, display names are hardcoded by phone number in `auth.controller.ts:50-60`.

---

## 9. RBAC
- **Middleware**:
  - `authenticate` in `backend/src/middleware/auth.ts`: decodes JWT, queries `prisma.user` including `roles` and their `permissions`.
  - `requirePermission(action)` in `backend/src/middleware/rbac.ts`: enforces permission existence or `ADMIN` role.
  - `requireRole(role)` in `backend/src/middleware/rbac.ts`: enforces role match or `ADMIN`.
- **RBAC Defect**: `PATIENT` role has 0 permissions. Accessing `/api/patients/:id/timeline` requires `patient.read`. A patient login succeeds, but reading their own timeline returns `403 Forbidden: Missing required permission: patient.read`.

---

## 10. API Inventory

| Method | Path | Auth Required? | Permission / Role | Controller | Database Models | Status |
|---|---|---|---|---|---|---|
| `GET` | `/health` | No | None | `index.ts` | None (`SELECT 1`) | VERIFIED |
| `POST` | `/api/auth/login` | No | None | `auth.controller.login` | User, Role, Patient | VERIFIED |
| `GET` | `/api/auth/doctors` | Yes | Authenticated | `auth.controller.getDoctors` | Doctor, User | VERIFIED |
| `POST` | `/api/patients` | Yes | `patient.create` | `patient.controller.createPatient` | Patient, PatientIdentifier, Condition | VERIFIED |
| `GET` | `/api/patients/search` | Yes | `patient.read` | `patient.controller.searchPatients` | Patient, Condition, Identifiers | VERIFIED |
| `GET` | `/api/patients/:id/timeline`| Yes | `patient.read` | `patient.controller.getPatientTimeline` | Patient, Encounter, Vitals, Conditions, Prescriptions | VERIFIED |
| `POST` | `/api/patients/encounter`| Yes | `encounter.create` | `patient.controller.createEncounter` | Encounter, Vital, ClinicalObs, Prescription | VERIFIED |
| `POST` | `/api/assessments` | Yes | `assessment.create` | `assessment.controller.createAssessment` | Assessment, Symptom, AIRecommendation | VERIFIED |
| `GET` | `/api/assessments` | Yes | `assessment.read` | `assessment.controller.getAssessmentsByPatient` | Assessment, Symptom, AIRecommendation | VERIFIED |
| `GET` | `/api/assessments/patient/:patientId` | Yes | `assessment.read` | `assessment.controller.getAssessmentsByPatient` | Assessment, Symptom, AIRecommendation | VERIFIED |
| `GET` | `/api/facilities` | Yes | `facility.read` | `facility.controller.getFacilities` | Facility, Service, Capacity, Availability | VERIFIED |
| `PUT` | `/api/facilities/:id/availability` | Yes | `facility.update` | `facility.controller.updateFacilityAvailability` | FacilityAvailability | VERIFIED |
| `POST` | `/api/appointments` | Yes | Authenticated | `appointment.controller.bookAppointment` | Appointment, QueueEntry | VERIFIED |
| `GET` | `/api/appointments` | Yes | Authenticated | `appointment.controller.getAllAppointments` | Appointment, Patient, Doctor | VERIFIED |
| `POST` | `/api/queue` | Yes | `encounter.create` | `queue.controller.enqueuePatient` | QueueEntry | VERIFIED |
| `GET` | `/api/queue` | Yes | Authenticated | `queue.controller.getAllQueue` | QueueEntry, Appointment, Patient, Doctor | VERIFIED |
| `GET` | `/api/queue/doctor/:doctorId` | Yes | Authenticated | `queue.controller.getQueueForDoctor` | QueueEntry, Appointment, Patient | VERIFIED |
| `PUT` | `/api/queue/:id/status`| Yes | Authenticated | `queue.controller.updateQueueStatus` | QueueEntry | VERIFIED |
| `POST` | `/api/referrals` | Yes | Authenticated | `referral.controller.createReferral` | Referral, ReferralEvent | VERIFIED |
| `PUT` | `/api/referrals/:id/status` | Yes | Authenticated | `referral.controller.updateReferralStatus` | Referral, ReferralEvent | VERIFIED |
| `POST` | `/api/followups/counter-referral` | Yes | Authenticated | `followup.controller.createCounterReferral` | CounterReferral, Referral, FollowUp | VERIFIED |
| `GET` | `/api/followups` | Yes | Authenticated | `followup.controller.listFollowUps` | FollowUp, Patient, Worker | VERIFIED |
| `PATCH`| `/api/followups/:id/complete` | Yes | Authenticated | `followup.controller.completeFollowUp` | FollowUp | VERIFIED |
| `POST` | `/api/notifications`| Yes | Authenticated | `notification.controller.createNotificationHandler` | Notification | VERIFIED |
| `GET` | `/api/notifications` | Yes | Authenticated | `notification.controller.getNotificationsHandler` | Notification | VERIFIED |
| `POST` | `/api/ai/triage` | Yes | Authenticated | `ai.controller.handleTriage` | AIRecommendation (Proxy to AI / Rule) | PARTIAL |
| `POST` | `/api/ai/route` | Yes | Authenticated | `ai.controller.handleRoute` | None (Proxy / Heuristic) | PARTIAL |
| `GET` | `/api/analytics/dashboard` | Yes | Authenticated | `analytics.controller.getDashboardMetrics` | Patient, Referral, Facility | VERIFIED |
| `POST` | `/api/sync` | Yes | Authenticated | `sync.controller.processSyncBatch` | SyncOperation, Patient, Assessment, Referral | VERIFIED |
| `GET` | `/api/sync/pull` | Yes | Authenticated | `sync.controller.pullSyncChanges` | Patient, Referral, FollowUp, Task, Notification | VERIFIED |
| `POST` | `/api/sync/conflict/resolve` | Yes | Authenticated | `conflict.controller.resolveSyncConflict` | SyncOperation | VERIFIED |

---

## 11. Patient Capabilities

1. **Patient Login**: PARTIAL. Supported on backend and frontend redirect, but display name resolution is unlinked to a direct User.name column.
2. **Patient Profile**: PARTIAL. `web/src/pages/PatientProfile.tsx` exists, but crashes or 403s if patient lacks `patient.read`.
3. **Patient Timeline**: PARTIAL. Backend queries all historical visits, vitals, prescriptions; blocked for patients by RBAC.
4. **Patient Health Record**: PARTIAL. Read-only timeline view exists; no self-service entry or consent approval UI.
5. **Facility Discovery**: EXISTS. `GET /api/facilities` returns live readiness and capacities.
6. **Doctor Discovery**: PARTIAL. `GET /api/auth/doctors` returns all doctors, but lacks search by specialty or location.
7. **Doctor Availability**: MISSING. No roster/slot scheduling model in database.
8. **Appointment Booking**: EXISTS. `POST /api/appointments` creates appointment and queue entry.
9. **Appointment Status**: EXISTS. Available via `GET /api/appointments`.
10. **Queue**: EXISTS. `GET /api/queue` and `QueueEntry` model exist.
11. **Queue Position**: PARTIAL. Priority and arrival time stored; position calculated client-side.
12. **Realtime Queue**: EXISTS. Socket.IO emits `queue.updated`.
13. **Diagnostics**: MISSING. `DiagnosticOrder` and `DiagnosticResult` exist in Prisma, but have 0 REST API endpoints.
14. **Prescriptions**: PARTIAL. Read via Encounter in timeline; no separate patient refill or prescription download API.
15. **Referrals**: EXISTS. Referral creation and tracking supported.
16. **Counter-referral**: EXISTS. Doctors can create counter-referrals with instructions for community workers.
17. **Follow-up**: EXISTS. ASHA workers list and complete assigned follow-ups.
18. **Notifications**: EXISTS. Database-backed in-app notifications.
19. **AI Triage**: PARTIAL. Rule-based heuristic fallback; no true clinical LLM.
20. **Offline**: PARTIAL. Dexie IndexedDB client with batch sync; appointments and queue are not offline-capable.
21. **Multilingual**: PARTIAL. English, Marathi, and Hindi static dictionary in `LocalizationContext.tsx`.
22. **Emergency Escalation**: PARTIAL. Referrals marked URGENT trigger priority socket events, but no external SMS/telephony integration.

---

## 12. Doctor Integration
- **Doctor -> Appointments**: Doctors view booked appointments linked to their `doctorId`.
- **Doctor -> Queue**: `GET /api/queue/doctor/:doctorId` filters queue for specific doctor.
- **Doctor -> Encounter**: Doctor submits clinical notes, vitals, and prescriptions via `POST /api/patients/encounter`.
- **Doctor -> Referral**: Doctor routes patient to higher facilities via `POST /api/referrals`.
- **Gaps**: Doctor cannot configure personal consultation hours; no in-consultation chat or telemedicine link.

---

## 13. ASHA/Worker Integration
- **Worker Dashboard**: `web/src/pages/WorkerDashboard.tsx` tracks assigned care gaps and village patients.
- **Field Encounters**: ASHA worker registers patient and initial triage assessment.
- **Follow-Up Tasks**: Counter-referrals from doctors automatically generate tasks in the worker's queue.
- **Gaps**: Worker tasks in mobile app contain UI mock components not yet wired to backend sync.

---

## 14. Appointment
- **Model**: `Appointment` with `patientId`, `facilityId`, `doctorId`, `scheduledAt`, `status`.
- **Endpoints**: `POST /api/appointments`, `GET /api/appointments`.
- **Gaps**: No cancellation endpoint (`PUT /api/appointments/:id/cancel`). Patients cannot filter appointments strictly for themselves via API query parameters.

---

## 15. Queue
- **Model**: `QueueEntry` with `appointmentId`, `doctorId`, `priority` (0, 1, 2), `status` (`WAITING`, `IN_CONSULTATION`, `COMPLETED`), `arrivalTime`.
- **Realtime**: Backend broadcasts `queue.updated` on status change.
- **Gaps**: No room isolation for patients (patients cannot listen to private queue position events).

---

## 16. Clinical Records
- Models: `Encounter`, `Vital`, `ClinicalObservation`, `Condition`, `Assessment`, `Symptom`.
- Aggregated via `GET /api/patients/:id/timeline`.
- Records are immutable once completed.

---

## 17. Referral
- **Model**: `Referral` with `originId`, `destinationId`, `urgency` (`ROUTINE`, `PRIORITY`, `URGENT`), `status` (`CREATED`, `SUBMITTED`, `ACCEPTED`, `COUNTER_REFERRED`, `CANCELLED`).
- State transitions tracked via `ReferralEvent` audit log.

---

## 18. Counter-referral
- **Model**: `CounterReferral` linked 1-to-1 with `Referral`.
- Contains `outcome`, `treatment`, `instructions`, and `requiresFollowUp` boolean flag.
- Creates `FollowUp` record for ASHA worker.

---

## 19. Follow-up
- **Model**: `FollowUp` with `dueDate`, `reason`, `notes`, `status` (`PENDING`, `OVERDUE`, `COMPLETED`).
- Cron job in `backend/src/jobs/caregap.job.ts` checks overdue tasks daily at midnight.

---

## 20. Notifications
- **Model**: `Notification` (`userId`, `type`, `message`, `isRead`).
- Endpoints: `POST /api/notifications`, `GET /api/notifications`.

---

## 21. Realtime
- Socket.IO server in `backend/src/events/socket.ts`.
- Rooms: `doctor_${doctorId}`, `facility_${facilityId}`, `worker_${workerId}`.
- Events: `triage.updated`, `queue.updated`, `counter_referral:created`.
- **Gap**: Missing `patient_${patientId}` room. Handshake authentication is unverified (no JWT validation on socket connection).

---

## 22. Offline/Sync
- **Client**: Dexie IndexedDB `AyuSyncDB` (`patients`, `mutationQueue`).
- **Server**: `POST /api/sync` (idempotent batch push using `syncOperation.id`), `GET /api/sync/pull` (delta pull with `since` timestamp).
- **Conflict Resolution**: `POST /api/sync/conflict/resolve`.

---

## 23. AI
- Microservice in `ai-service/main.py`:
  - `POST /triage`: Heuristic analysis of SpO2, Temp, HR, and critical keywords with artificial `time.sleep(1.5)`.
  - `POST /route`: Facility scoring based on availability and services.
- **Finding**: No actual machine learning or LLM inference. Both microservice and backend fallback are deterministic rule-based algorithms.

---

## 24. Agentic AI
- **Finding**: **NOT IMPLEMENTED**.
- There are no autonomous agents, tool-calling loops, multi-agent debates, or memory persistence in the codebase, despite `langchain` in `requirements.txt`.

---

## 25. Analytics
- Endpoint: `GET /api/analytics/dashboard`.
- Computes aggregate counts from PostgreSQL: total patients, active referrals, facility readiness, and emergency queue metrics.

---

## 26. Interoperability
- `backend/src/modules/interop/abha.adapter.ts`: **MOCK**. Static `MOCK_REGISTRY` with one hardcoded user (`Rahul Kumar`, ABHA `14-1111-2222-3333`).
- `backend/src/modules/interop/abdm.adapter.ts`: **SANDBOX SIMULATION**. Emulates FHIR resource mapping and returns dummy correlation IDs (`SANDBOX-CORR-...`). Real gateway integration throws "UNVERIFIED — EXTERNAL CREDENTIAL REQUIRED".

---

## 27. No-Mock Audit
Categorization of audit findings:

### Category A — Seed & Test Fixtures (Acceptable)
- `backend/prisma/seed.ts`: Deterministic mock patient profiles (`pat-ramesh-kulkarni`, `pat-pooja-sharma`, etc.) and clinical histories.
- `backend/test_phase_*.js`: Test assertions.

### Category B — Runtime Mocks That Must Be Removed / Addressed
1. `backend/src/modules/auth/auth.controller.ts:50-60`: Hardcoded display names based on telephone number string matching.
2. `backend/src/modules/interop/abha.adapter.ts:4-11`: Static `MOCK_REGISTRY` object for ABHA verification.
3. `backend/src/modules/routing/routing.service.ts:19`: Hardcoded `queueLength = 0` and mock distance scoring.
4. `backend/src/jobs/reminder.job.ts:31`: Mock SMS dispatch log.
5. `web/src/pages/PatientIntakeFlow.tsx:159`: `Math.random()` generating token `REF-YYYY-xxxx`.
6. `web/src/pages/PatientIntakeFlow.tsx:174, 205`: `Math.random()` generating fallback random phone numbers.
7. `web/src/pages/PatientIntakeFlow.tsx:207`: `Math.random()` generating fallback random ABHA IDs.
8. `web/src/pages/ReferralSuccess.tsx:8`: `Math.random()` generating referral token in render cycle.
9. `web/src/components/sync/SyncCenter.tsx:5`: Static mock conflict resolution state.

### Category C — Documentation Examples (Acceptable)
- `AUDIT_REPORT.md`, `complete_master_plan.md`: Documentation notes.

### Category D — Legitimate Fallbacks (Acceptable)
- `web/src/lib/db.ts:42`: `Math.random()` used solely for generating local offline `operationId` client UUID.
- `backend/src/lib/redis.ts:42`: Standalone in-memory fallback when Redis server is not provisioned.
- `backend/src/modules/ai/ai.service.ts`: Rule-based clinical triage fallback when Python microservice is offline.

---

## 28. Tests
- `backend/tests/referral.test.ts`: Trivial static dictionary test.
- `backend/test_phase_c.js`, `e`, `f`, `g`, `failures.js`: Node/Axios integration scripts expecting a live server at `http://localhost:5000`.
- Unit tests, automated CI runners, and component tests: **MISSING**.

---

## 29. Build & Lint Verification
- **Backend Typecheck**: Passes cleanly with **0 errors** when dependencies and Prisma client are present.
- **Frontend Typecheck**: Passes cleanly with **0 errors** (`tsc --noEmit`).
- **Frontend ESLint**: **FAILS with 10 errors** (`npm run lint`):
  - `App.tsx:72, 73, 74`: Direct mutation of `window.location.href` inside handler (`react-hooks/immutability`).
  - `useSync.ts:18, 28`: Accessing `updatePendingCount` and `syncData` prior to declaration.
  - `PatientIntakeFlow.tsx:220`: Empty catch block (`no-empty`).
  - `Queue.tsx:491`: Unused variable `err` (`@typescript-eslint/no-unused-vars`).
  - `ReferralSuccess.tsx:8`: Calling `Math.random()` during render (`react-hooks/purity`).
  - `WorkerDashboard.tsx:149, 157`: Empty catch blocks (`no-empty`).

---

## 30. Runtime Baseline
- Tested against local PostgreSQL 15 container (`ayusync-postgres-1`).
- Backend starts successfully on port `5000`.
- Health Check: `GET http://localhost:5000/health` returns `HTTP 200 OK`:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "redis": "standalone_fallback",
    "uptimeSeconds": 227,
    "timestamp": "2026-09-08T03:57:54.055Z"
  }
  ```

---

## 31. Gaps Identified
1. **Frontend API URL Fallback**: `web/` lacks `.env`, causing calls to route to `http://localhost:5173/api/...` instead of the backend.
2. **Missing `patient.read` for PATIENT role**: Seed script omits permissions for `PATIENT`, causing a 403 Forbidden on timeline query.
3. **Hardcoded User Names in Auth**: `auth.controller.ts` determines doctor/worker display names via hardcoded phone string checks.
4. **Prisma Environment Requirement**: Backend crashes on start/validate if `DIRECT_URL` is omitted, even when connection pooling is not used.
5. **No REST Routes for Diagnostics**: `DiagnosticOrder` and `DiagnosticResult` tables exist but have no API routes.
6. **No Realtime Room for Patients**: `socket.ts` only has rooms for doctors, workers, and facilities.
7. **ESLint Validation Errors**: 10 strict React 18 / Hook lint errors in web.
8. **Random Value Generators in Intake**: Frontline intake page generates random phone numbers, ABHA IDs, and tokens instead of enforcing valid inputs.
9. **No Real Agentic AI**: AI is a rule-based simulation; no agent loop exists.
10. **Seed Credential Leak**: Hardcoded Supabase URL in `backend/prisma/seed.ts:7`.

---

## 32. Recommended Implementation Order
1. **Environment Setup**: Create `backend/.env` and `web/.env` with `VITE_API_URL=http://localhost:5000`.
2. **PostgreSQL Role Provisioning**: Create role `ayusync` in PostgreSQL and set ownership.
3. **Prisma & Seed Fix**:
   - Assign `patient.read` to `PATIENT` role in seed.
   - Remove hardcoded Supabase URL fallback from `seed.ts`.
4. **Auth Display Name Resolution**: Query real `Doctor`/`Worker`/`Patient` tables instead of phone string matching.
5. **Frontend Lint & Purity Fixes**: Fix the 10 ESLint errors in `App.tsx`, `useSync.ts`, `ReferralSuccess.tsx`.
6. **Patient Realtime Room**: Add `join:patient` and emit private updates to `patient_${patientId}`.
7. **Diagnostic & Prescription API**: Expose patient diagnostic orders and active prescriptions.
8. **Patient Self-Service APIs**: Appointment self-booking, cancellation, and personal queue status.
9. **Intake Form Sanitation**: Remove `Math.random()` fallbacks in `PatientIntakeFlow.tsx`.
10. **Patient Dashboard Implementation**: Build the patient self-service portal against verified backend endpoints.

