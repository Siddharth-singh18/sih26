# AYUSYNC — FACILITY & OPERATIONS INTELLIGENCE AUDIT & GAP ANALYSIS

**Repository:** `/home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean`  
**Database:** PostgreSQL 15.19 (`ayusync-postgres-1` on port 5432)  
**Date:** September 8, 2026  
**Audited By:** Antigravity AI Pair Programming System  
**Audit Target:** Facility, Capacity, Availability, Service, Routing & Operations Intelligence  
**Status:** COMPLETE AUDIT ONLY (Zero Code Modifications in this Phase)  

---

## 1. CURRENT GIT STATE

- **Working Tree Status:** Cleanly tracking `AyuSync-clean`.
- **Untracked files:** Test suites (`asha_workflow.test.ts`, `doctor_workflow.test.ts`, `patient_workflow.test.ts`), `backend/src/modules/diagnostics/`, `web/src/pages/PatientDashboard.tsx`, and verified audit documentation (`docs/*`).
- **Isolation Status:** The original repository `/home/siddharth-singh18/Development/swasthyaSetu/AyuSync` remains completely untouched.
- **Dependency Guard:** Patient Workflow (29/29), ASHA Workflow (31/31), Doctor & Specialist Workflow (31/31), and Referral State Machine (4/4) are **FROZEN DEPENDENCIES**.

## 2. CURRENT HEAD

- **Commit Hash:** `03c37dda50ca4b3ee152fc31568d4f8cbbdafc98`
- **Commit Message:** `AI features`
- **Active Branch:** `main`

---

## 3. DATABASE ROW COUNTS (AUTHENTIC POSTGRESQL STATE)

All counts directly queried from live PostgreSQL 15.19 (`ayusync` database):

| Model / Table | Row Count | Operational Scope & Status |
| :--- | :--- | :--- |
| **`Facility`** | **5** | 2 PHCs, 2 CHCs, 1 District Hospital |
| **`FacilityService`** | **20** | Diagnostic, emergency, maternal, trauma services across facilities |
| **`FacilityAvailability`** | **5** | 1:1 availability record per facility (OPEN / OVERCAPACITY) |
| **`FacilityCapacity`** | **14** | General ward, ICU, oxygen, maternity, NICU bed resources |
| **`Doctor`** | **3** | CMO Dr. Rajesh Deshmukh, OBGYN Dr. Priya Kulkarni, Peds Dr. Anand Joshi |
| **`FacilityDoctor`** | **4** | Cross-facility doctor-hospital associations |
| **`Specialist`** | **3** | Internal Medicine, Obstetrics & Gynecology, Pediatrics |
| **`Appointment`** | **20** | Outpatient clinic bookings across doctors and facilities |
| **`QueueEntry`** | **20** | Outpatient queue tokens with priority, arrival times, and status |
| **`Referral`** | **17** | Inter-facility referrals between PHC, CHC, and District Hospital |
| **`ReferralEvent`** | **33** | Immutable audit trail of referral state machine transitions |
| **`DiagnosticOrder`** | **10** | Laboratory and imaging investigation orders |
| **`DiagnosticResult`** | **3** | Verified lab result values with abnormal flag |
| **`FollowUp`** | **16** | Closed-loop ASHA home-visit care directives |
| **`Notification`** | **25** | System and clinical notifications stored in PostgreSQL |
| **`Encounter`** | **18** | CLINIC_VISIT and FIELD_VISIT patient clinical encounters |
| **`Prescription`** | **9** | Structured medication orders linked to encounters |
| **`Patient`** | **21** | Registered patients across rural Maharashtra catchment areas |
| **`Worker`** | **3** | Frontline ASHA workers (Sunita Patil, Vandana Shinde, Kavita More) |
| **`User`** | **11** | 3 Workers, 3 Doctors, 5 Patients |

---

## 4. EXISTING FACILITY ARCHITECTURE

### Live Facility Entities in PostgreSQL
1. **Baramati Sub-District Hospital & CHC (`fac-baramati-chc`)**:
   - Type: `CHC` | Level: 2 | Lat: `18.1517`, Lng: `74.5772` | Address: Near Bus Stand, Baramati
   - Assigned Doctors: `doc-rajesh-deshmukh` (Internal Medicine), `doc-priya-kulkarni` (OBGYN)
   - Status: `OPEN` | Readiness Score: `92/100`
2. **Aundh District Hospital, Pune (`fac-pune-dist`)**:
   - Type: `DISTRICT` | Level: 3 | Lat: `18.5590`, Lng: `73.8070` | Address: Aundh, Pune
   - Assigned Doctors: `doc-priya-kulkarni` (OBGYN)
   - Status: `OPEN` | Readiness Score: `95/100`
3. **Khandala Primary Health Centre (`fac-khandala-phc`)**:
   - Type: `PHC` | Level: 1 | Lat: `18.0531`, Lng: `74.0272` | Address: Shirwal-Khandala Road
   - Assigned Doctors: None assigned in `FacilityDoctor` (relies on visiting MOs & ASHA cohort)
   - Status: `OPEN` | Readiness Score: `78/100`
4. **Saswad Primary Health Centre (`fac-saswad-phc`)**:
   - Type: `PHC` | Level: 1 | Lat: `18.3444`, Lng: `74.0294` | Address: Purandar Taluka, Saswad
   - Assigned Doctors: None assigned in `FacilityDoctor`
   - Status: `OVERCAPACITY` | Readiness Score: `48/100`
5. **Junnar Rural Hospital & Trauma Centre (`fac-junnar-chc`)**:
   - Type: `CHC` | Level: 2 | Lat: `19.2087`, Lng: `73.8763` | Address: Shivneri Road, Junnar
   - Assigned Doctors: `doc-anand-joshi` (Pediatrics & Neonatal Care)
   - Status: `OPEN` | Readiness Score: `86/100`

### Architecture Strengths
- Geographical coordinates (`latitude`, `longitude`) are stored for all 5 facilities.
- Multi-tier referral relationships (`referralsIn` and `referralsOut`) link PHCs to CHCs and District Hospitals.
- `FacilityDoctor` implements a clean many-to-many relationship supporting multi-facility visiting specialists.

---

## 5. EXISTING CAPABILITY ARCHITECTURE

| Capability Aspect | Schema Representation | Real PostgreSQL Status | Limitations |
| :--- | :--- | :--- | :--- |
| **Facility Type** | `Facility.type` (String) | `"PHC"`, `"CHC"`, `"DISTRICT"` | Freeform string rather than typed enum. |
| **Care Tier / Level** | `Facility.level` (Int) | `1` (PHC), `2` (CHC), `3` (District) | Stored and utilized in routing. |
| **Specialties** | `FacilityDoctor` -> `Doctor` -> `Specialist.specialty` | `Internal Medicine`, `OBGYN`, `Pediatrics` | Linked via doctors, but no facility-level specialty registry. |
| **Clinical Services** | `FacilityService.service` (String) | 20 authentic rows in DB | Freeform strings; no service category enum. |
| **Diagnostic Services** | `FacilityService` text strings | `"Digital X-Ray"`, `"CT Scan"`, `"USG"` | Not linked to `DiagnosticOrder` test types. |
| **Emergency Services** | `FacilityService` text strings | `"Emergency & Trauma Care"`, `"24x7 Ambulance"` | No SLA or emergency readiness flag. |
| **Operating Hours** | **NOT_SUPPORTED_BY_SCHEMA** | None | No opening/closing time fields in schema. |
| **Equipment Inventory** | **NOT_SUPPORTED_BY_SCHEMA** | None | Mentioned in `FacilityCapacity.resource` (e.g. Oxygen Concentrators) but no dedicated model. |

---

## 6. EXISTING AVAILABILITY ARCHITECTURE

### PostgreSQL Model: `FacilityAvailability`
- **Fields:**
  - `facilityId` (UUID, unique relation to `Facility`)
  - `status` (`"OPEN"`, `"CLOSED"`, `"OVERCAPACITY"`)
  - `readinessScore` (Float: 0 to 100)
  - `updatedAt` (DateTime)
- **Current Live Statuses:**
  - `fac-baramati-chc`: `OPEN`, Readiness 92
  - `fac-pune-dist`: `OPEN`, Readiness 95
  - `fac-khandala-phc`: `OPEN`, Readiness 78
  - `fac-saswad-phc`: `OVERCAPACITY`, Readiness 48
  - `fac-junnar-chc`: `OPEN`, Readiness 86
- **Endpoints:**
  - `GET /api/facilities`: Returns availability object with each facility.
  - `PUT /api/facilities/:id/availability`: Updates `status` and `readinessScore`.
- **Gaps:**
  - No operating days or opening/closing hours.
  - No doctor on-duty/shift scheduling status.
  - No service-level downtime scheduling.

---

## 7. EXISTING CAPACITY ARCHITECTURE

### PostgreSQL Model: `FacilityCapacity`
- **Fields:** `id`, `facilityId`, `resource` (String), `total` (Int), `occupied` (Int), `updatedAt` (DateTime).
- **All 14 Live Capacity Resources:**
  1. **Baramati CHC**:
     - General Ward Beds: 60 Total, 42 Occupied (18 Available — 70% Occupancy)
     - Maternal Delivery Beds: 18 Total, 12 Occupied (6 Available — 66% Occupancy)
     - Oxygen Support Beds: 24 Total, 15 Occupied (9 Available — 62% Occupancy)
     - ICU / HDU Beds: 8 Total, 5 Occupied (3 Available — 62% Occupancy)
  2. **Aundh District Hospital**:
     - General Ward Beds: 250 Total, 198 Occupied (52 Available — 79% Occupancy)
     - ICU Beds: 32 Total, 26 Occupied (6 Available — 81% Occupancy)
     - NICU / PICU Beds: 20 Total, 16 Occupied (4 Available — 80% Occupancy)
     - Oxygen Support Beds: 80 Total, 54 Occupied (26 Available — 67% Occupancy)
  3. **Khandala PHC**:
     - Observation Beds: 10 Total, 6 Occupied (4 Available — 60% Occupancy)
     - Labor Delivery Room: 4 Total, 2 Occupied (2 Available — 50% Occupancy)
  4. **Saswad PHC**:
     - Observation Beds: 12 Total, 12 Occupied (0 Available — **100% Saturated / Overcapacity**)
     - Oxygen Concentrators: 4 Total, 4 Occupied (0 Available — **100% Saturated**)
  5. **Junnar CHC**:
     - General Ward Beds: 40 Total, 28 Occupied (12 Available — 70% Occupancy)
     - Trauma Emergency Beds: 10 Total, 7 Occupied (3 Available — 70% Occupancy)
- **Gaps:**
  - Zero mutation APIs: There is NO backend endpoint to update, occupy, or release beds/capacities.
  - Zero UI components in `FacilityReadiness.tsx` displaying or modifying bed occupancies.

---

## 8. EXISTING ROUTING ARCHITECTURE

### Primary Routing Implementation: `handleRoute` in `backend/src/modules/ai/ai.controller.ts`
Route: `POST /api/ai/route` (Authenticated)

### Factor-by-Factor Analysis
| Routing Factor | Status | Actual Implementation Evidence |
| :--- | :--- | :--- |
| **1. Required Specialty** | **PARTIALLY USED** | Substring match on `fac.services.some(s => s.service.toLowerCase().includes(req.body.requiredSpecialty.toLowerCase()))`. +15 points. **Gap:** Does NOT check `Doctor` or `Specialist` table! |
| **2. Required Service** | **NOT USED** | Request body parameter `requiredService` is not parsed or matched. |
| **3. Facility Capability** | **PARTIALLY USED** | Checks `fac.level === 3` (+10 pts) and `fac.level === 2` (+5 pts). |
| **4. Facility Availability** | **USED** | Incorporates `readinessScore` (+0.3 * (readiness - 50)); applies -20 penalty if `OVERCAPACITY`. |
| **5. Capacity** | **PARTIALLY USED** | Only checks `resource.toLowerCase().includes('icu')` and adds +10 if `total > occupied`. Ignores all other beds and occupancy percentage. |
| **6. Urgency** | **NOT USED** | Urgency (`req.body.urgency`) is passed by caller but completely ignored in score calculation! |
| **7. Distance / Location** | **NOT USED** | Uses synthetic fallback: `distance_km: (idx + 1) * 6.2`. Ignores `patientLocation` and `facility.latitude/longitude`! |
| **8. Current Queue Load** | **NOT USED** | Does NOT query live `QueueEntry` count or waiting patients. |

### Dead Code in `backend/src/modules/routing/routing.service.ts`
- Contains `getOptimalFacilities` with `const queueLength = 0; // Mocked for now`.
- This function is **dead code** — not imported or routed anywhere in the system.

---

## 9. EXISTING DASHBOARDS

1. **`web/src/pages/Dashboard.tsx`**:
   - Primary Medical Officer (MO) clinic dashboard.
   - Shows live Baramati CHC queue, doctor consultation queue, care alerts, and facility overview.
   - Powered by real PostgreSQL `/api/queue` and `/api/facilities`.
2. **`web/src/pages/FacilityReadiness.tsx`**:
   - Routed at `/facilities`.
   - Fetches live facilities via `GET /api/facilities`.
   - **Gaps:** Only renders facility name, type, level, status badge, and readiness score. Has fallback address `'Mokama, Bihar'` if address is null. Does NOT render capacities, beds, services, doctors, or queue load. Only allows toggling status with a hardcoded `readinessScore: 80`.
3. **`web/src/pages/PredictiveOps.tsx`**:
   - **Unrouted in `App.tsx`**.
   - Fetches from `GET /api/analytics/dashboard`.
   - Shows system-wide patient/referral counts, and renders hardcoded mock forecasts (`Paracetamol` stockout risk, `Complete Blood Count` demand).
4. **`web/src/pages/DemoFlow.tsx`**:
   - Floating narrative walkthrough widget.

---

## 10. EXISTING REALTIME (SOCKET.IO)

### Handlers & Rooms in `backend/src/events/socket.ts`
- **Supported Rooms:**
  - `doctor_${doctorId}`: Subscribed via `join:doctor`.
  - `facility_${facilityId}`: Subscribed via `join:facility`.
  - `worker_${workerId}`: Subscribed via `join:worker`.
  - `patient_${patientId}`: Subscribed via `join:patient`.
- **Supported Emits:**
  - `queue.updated`: Emitted to `facility_${facilityId}`, `doctor_${doctorId}`, `patient_${patientId}`.
  - `triage.updated`: Emitted to `doctor_${doctorId}`.
  - `patient.updated` & `prescription.added`: Emitted to `patient_${patientId}`.
  - `counter_referral:created`: Emitted to `worker_${workerId}`.
  - `followup:created` & `followup:updated`: Emitted to `worker_${workerId}`.
- **Critical Realtime Gaps:**
  - **No capacity updates:** Zero socket events emitted when beds or resources are updated.
  - **No facility referral updates:** Facilities do not receive live socket events when new referrals arrive.
  - **No facility status updates:** When facility availability changes (`OPEN` <-> `OVERCAPACITY`), no event is broadcast.

---

## 11. SECURITY FINDINGS

### A. Missing Facility-Level Mutation Authorization (High Vulnerability)
- **Endpoint:** `PUT /api/facilities/:id/availability`
- **Current Check:** `requirePermission('facility.update')` (held by all users with role `DOCTOR`).
- **Vulnerability:** Any doctor can supply ANY facility ID in the URL and modify the operational status and readiness score of facilities they do NOT belong to.
- **Requirement:** Backend must verify that `req.user.doctorId` has an active record in `FacilityDoctor` for the target `facilityId`, or that the user has an `ADMIN` role.

### B. Socket.IO Room Hijacking (Medium Vulnerability)
- In `backend/src/events/socket.ts`:
  ```ts
  socket.on('join:facility', (facilityId: string) => {
    socket.join(`facility_${facilityId}`);
  });
  ```
- Any connected socket client can emit `join:facility` for any facility ID without JWT authentication or facility-membership verification.

### C. Missing Admin & District Officer Roles
- In `backend/src/middleware/rbac.ts`, `req.user.roles.includes('ADMIN')` is checked as a superuser bypass.
- However, in PostgreSQL, the `Role` table contains ONLY `WORKER`, `DOCTOR`, and `PATIENT`.
- There is NO `ADMIN` or `DISTRICT_OFFICER` role provisioned in the database!

---

## 12. NO-MOCK AUDIT CLASSIFICATION

| Finding Location | Content Found | Classification | Verdict |
| :--- | :--- | :--- | :--- |
| `backend/src/modules/analytics/analytics.controller.ts:39-50` | Hardcoded `medicine_stockout_risk` and `diagnostic_demand_forecast` | **NOT ALLOWED** (Fake runtime analytics) | Must be replaced with deterministic DB-driven statistical intelligence or honestly marked. |
| `backend/src/modules/ai/ai.controller.ts:240-241` | `distance_km: (idx + 1) * 6.2`, `travel_time: (idx + 1) * 15` | **NOT ALLOWED** (Synthetic routing numbers) | Must calculate genuine Haversine distance using patient and facility lat/lng. |
| `backend/src/modules/routing/routing.service.ts:19` | `const queueLength = 0; // Mocked for now` | **DEAD CODE** | Dead unreferenced file; remove or replace with authentic DB query. |
| `web/src/pages/FacilityReadiness.tsx:104` | `fac.address \|\| 'Mokama, Bihar'` | **NOT ALLOWED** (Hardcoded fallback address) | Remove fallback string; all 5 DB facilities have authentic Maharashtra addresses. |
| `web/src/pages/Login.tsx:144-267` | "Quick Demo Access" credential cards | **ALLOWED** | UI testing/eval shortcut for seeded test accounts. |
| `backend/src/modules/interop/abha.adapter.ts:4` | `MOCK_REGISTRY` for ABHA sandbox | **ALLOWED** | Explicit external sandbox adapter honestly labeled `BLOCKED_EXTERNAL`. |
| `backend/src/jobs/reminder.job.ts:31` | External SMS provider mock | **ALLOWED** | External sandbox adapter honestly labeled `BLOCKED_EXTERNAL`. |
| `backend/tests/*.test.ts` | Test fixtures (`uniquePhone`, `testSlotDate`) | **ALLOWED** | Standard dynamic test inputs. |

---

## 13. SCHEMA LIMITATIONS (WHAT IS NOT SUPPORTED BY DB SCHEMA)

1. **Operating Hours:** `Facility` has no fields for opening time, closing time, or operating days.
2. **Equipment Inventory:** No dedicated `Equipment` or `Inventory` table; only freeform text in `FacilityCapacity.resource`.
3. **Doctor Shift / On-Duty Status:** `FacilityDoctor` is a join table (`facilityId`, `doctorId`) with no shift, status, or schedule columns.
4. **Service-to-Specialty Foreign Keys:** `FacilityService` has no foreign key to `Specialist` or `Doctor`.
5. **District / Administrative Hierarchy:** `Facility` has no `districtId` or `parentFacilityId` foreign key.
6. **Capacity History:** `FacilityCapacity` stores only current `total` and `occupied` with `updatedAt`; no time-series log table for bed occupancy changes.

---

## 14. SIH CAPABILITY MATRIX

| Item | Target Capability | Audit Classification | Current System State |
| :--- | :--- | :--- | :--- |
| **A** | Facility Capability Registry | **PARTIAL** | `Facility` stores type, level, address, lat/lng for 5 facilities; lacks operational hours and hierarchy. |
| **B** | Facility Services | **PARTIAL** | 20 authentic rows in `FacilityService` with availability boolean; lacks categorization & update API. |
| **C** | Specialty Availability | **PARTIAL** | Doctors linked to facilities and specialties; lacks real-time on-duty status. |
| **D** | Diagnostic Availability | **PARTIAL** | Diagnostic services exist as text; no link to `DiagnosticOrder` test catalogue or turnaround times. |
| **E** | Bed / Capacity Visibility | **PARTIAL** | 14 authentic rows in `FacilityCapacity` covering ICU, General, O2; lacks mutation API and UI display. |
| **F** | Doctor / Specialist Availability | **PARTIAL** | `getAppointmentAvailability` checks facility status and doctor appointments; lacks on-duty shift tracking. |
| **G** | Queue Load | **PARTIAL** | Live queue tracked per facility in PostgreSQL; NOT factored into routing score calculations. |
| **H** | Capability-Aware Routing | **PARTIAL** | Checks facility level (3 vs 2) and service substring; does not query doctor specialists. |
| **I** | Availability-Aware Routing | **VERIFIED** | Checks `status === 'OPEN'` vs `'OVERCAPACITY'` (-20 pts) and uses `readinessScore`. |
| **J** | Capacity-Aware Routing | **PARTIAL** | Checks ICU availability; ignores general beds, maternity beds, and saturation percentage. |
| **K** | Operational Dashboard | **PARTIAL** | `Dashboard.tsx` works for clinic MO; `FacilityReadiness.tsx` is minimal (no beds, queues, or services). |
| **L** | District-Level Dashboard | **NOT_IMPLEMENTED** | No district comparative view, admin route, or district analytics dashboard. |
| **M** | Referral Bottleneck Visibility | **NOT_IMPLEMENTED** | No calculation of referral transfer latency, dwell times, or inter-facility bottlenecks. |
| **N** | Real-Time Operational Updates | **PARTIAL** | Sockets exist for queue and follow-up tasks; NO socket events for capacity, beds, or referrals. |
| **O** | Predictive Operations | **NOT_IMPLEMENTED** | `analytics.controller.ts` returns hardcoded static JSON; `generateSupplyChainPredictions` is dead code. |

---

## 15. EXACT MISSING FUNCTIONALITY

1. **Haversine Distance & Travel Time Calculation:** `handleRoute` must compute real spherical distance from `patientLocation` (`latitude`, `longitude`) to `facility.latitude/longitude`, replacing synthetic `(idx + 1) * 6.2`.
2. **Comprehensive Routing Engine Scoring:**
   - Incorporate `urgency` (URGENT cases heavily prioritize Level 3 District Hospital with ICU).
   - Incorporate live `queueEntries` count (penalize facilities with long waiting queues).
   - Match `requiredSpecialty` against `FacilityDoctor` -> `Doctor` -> `Specialist.specialty` in addition to `FacilityService`.
   - Incorporate bed occupancy ratio (`occupied / total`) from `FacilityCapacity`.
3. **Facility Capacity Management API:**
   - `PUT /api/facilities/:id/capacity/:capacityId`: Update `occupied` and `total` beds.
   - Enforce facility ownership (only authorized doctors/admins of that facility can update).
4. **Facility-Level Security Enforcements:**
   - Verify doctor belongs to facility via `FacilityDoctor` before allowing `updateFacilityAvailability` or capacity updates.
5. **District Operations & Analytics Endpoint:**
   - `GET /api/facilities/operations/district`: Aggregated multi-facility comparison showing total/occupied beds, queue loads, incoming/outgoing referral counts, and bottleneck latency.
6. **Real-Time Capacity & Facility Events:**
   - Emit `facility:capacity.updated` and `facility:status.updated` to `facility_${facilityId}` and district rooms.
7. **Frontend Operations Center Overhaul:**
   - Upgrade `FacilityReadiness.tsx` into a full **Facility & District Operations Intelligence Hub**:
     - Bed capacity meters (General, ICU, Oxygen, Maternal) with live occupancy bars.
     - Service availability list with status pills.
     - Facility doctor & specialist roster.
     - Real-time queue and referral load metrics.
     - Authorized capacity update modal.
8. **Predictive Analytics Replacement:**
   - Replace hardcoded static JSON in `analytics.controller.ts` with real database aggregation (e.g. recent assessment symptom frequency, pending referral rate, and stockout risk heuristic based on actual caseload).

---

## 16. RECOMMENDED IMPLEMENTATION ORDER

```
Step 1: Security & Ownership Hardening (FacilityDoctor authorization check on mutations)
Step 2: Backend Capacity & Service Management APIs (PUT /capacity, GET /operations/district)
Step 3: Authentic Haversine Distance & Multi-Factor Routing Engine Upgrade (ai.controller.ts)
Step 4: Real-Time Operational Socket Events (facility:capacity.updated, facility:status.updated)
Step 5: Dynamic Predictive Analytics Engine (Database-driven caseload forecasting)
Step 6: Frontend Operations Intelligence Center Overhaul (FacilityReadiness.tsx & District View)
Step 7: Automated Integration Test Suite (backend/tests/facility_operations.test.ts)
Step 8: Cross-Role Verification & Zero-Regression Triple Run (Facility + Doctor + ASHA + Patient)
```

---

## 17. AUDIT COMPLETION STATEMENT

This completes the independent, exhaustive audit of the Facility & Operations Intelligence module. **No application source code or database schema has been modified during this audit.**
