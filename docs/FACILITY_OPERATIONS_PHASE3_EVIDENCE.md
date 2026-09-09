# AYUSYNC — FACILITY & OPERATIONS INTELLIGENCE (PHASE 3) EVIDENCE AUDIT
## REAL, DATABASE-BACKED, CAPABILITY-AWARE FACILITY ROUTING

**Repository:** `/home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean`  
**Database:** PostgreSQL 15.19 (`ayusync-postgres-1` on host port 5432)  
**Date:** September 8, 2026  
**Audited By:** Antigravity AI Pair Programming System  
**Scope:** Phase 3 — Real Database-Backed Capability-Aware Facility Routing Implementation + Full Evidence Audit  
**Status:** FULLY IMPLEMENTED, VERIFIED & PASSING (151/151 Total Tests Passing Across All Integration Suites)  

---

## 1. EXECUTIVE SUMMARY & VERIFICATION DASHBOARD

| Metric | Target | Achieved Status | Verification Method |
| :--- | :--- | :--- | :--- |
| **Facility Routing Suite** | 25+ Scenarios | **38 / 38 Passed (100%)** | `tests/facility_routing.test.ts` |
| **Facility Operations Suite** | 22 Scenarios | **22 / 22 Passed (100%)** | `tests/facility_operations.test.ts` |
| **Doctor / Specialist Suite** | 31 Scenarios | **31 / 31 Passed (100%)** | `tests/doctor_workflow.test.ts` |
| **ASHA Worker Suite** | 31 Scenarios | **31 / 31 Passed (100%)** | `tests/asha_workflow.test.ts` |
| **Patient Workflow Suite** | 29 Scenarios | **29 / 29 Passed (100%)** | `tests/patient_workflow.test.ts` |
| **Total Test Baseline** | **141+ Passed** | **151 / 151 Passed (0 Failures)** | Full Suite Execution |
| **Mock Audit (C / D)** | C=0, D=0 | **C=0, D=0 (Zero Mock Data)** | Source Code & Grep Audit |
| **Database Pollution** | 0 Unintended Rows | **0 Deviations (Read-Only)** | Pre/Post Row Count Verification |
| **Unsupported Data** | Honest Schema Handling | **`NOT_SUPPORTED_BY_SCHEMA`** | Distance & Hours Handled |

---

## 2. PRODUCTION FILES CREATED / MODIFIED

### Backend Core Engine & Endpoints
1. **`backend/src/modules/routing/routing.service.ts`**
   - Implemented `calculateOptimalRoutes(params: RouteRequest, prismaClient?: PrismaClient)`:
     - Pure PostgreSQL evaluation: queries `Facility`, `FacilityService`, `FacilityCapacity`, `FacilityAvailability`, `FacilityDoctor`, and live `QueueEntry`.
     - Explicit separation of **Eligibility** (`eligible: boolean`, `ineligibilityReasons: string[]`) vs. **Ranking Score** (`score: 15-99`).
     - Multi-factor clinical suitability: Service matching, Doctor/Specialist matching, Bed capacity matching (General, ICU, Oxygen, Maternity, NICU), Urgency alignment (Emergency, Urgent, Routine), Live active queue load, and Haversine distance.
     - Multi-tier deterministic sorting: Eligible first, score descending, level descending (Tertiary > Secondary > Primary), readiness score descending, queue load ascending.
     - Pure Haversine formula calculation without external GIS dependencies.
     - Honest handling of missing coordinates: returns `distanceStatus: 'NOT_SUPPORTED_BY_SCHEMA'` without fabricating fake locations.
     - Dual naming support (`facility_id` & `facilityId`, `facility_name` & `facilityName`, `score` & `matchScore`) for 100% backward compatibility.
     - Parameters supported: `urgency`, `requiredSpecialty`, `requiredService`, `requiredBedType`, `patientLocation`, `excludeFacilityIds`, `maxDistanceKm`, `limit`.

2. **`backend/src/modules/facilities/facility.controller.ts`**
   - Added `getFacilityRouting(req: AuthRequest, res: Response)`:
     - Enforces server-side validation: validates urgency, bed type, coordinate bounds (-90 to 90, -180 to 180), numeric radius limits, and pagination limits.
     - Calls `calculateOptimalRoutes`.
     - Returns `{ ranked_facilities, meta: { totalEvaluated, eligibleCount, ineligibleCount, urgency, weightsUsed, distanceHandling } }`.

3. **`backend/src/modules/facilities/facility.routes.ts`**
   - Mounted `POST /route` with `authenticate` and `requirePermission('facility.read')`.

4. **`backend/src/modules/ai/ai.controller.ts`**
   - Updated `handleRoute` to return `{ ranked_facilities, meta }` with full telemetry, guaranteeing zero disruption to ASHA mobile intake flows.

5. **`backend/src/index.ts`**
   - Guarded `httpServer.listen` with `if (require.main === module)` to prevent port re-bind errors during test execution.

### Frontend Telemetry & UI
6. **`web/src/components/routing/RoutingSuggestions.tsx`**
   - Replaced static placeholder mockup with dynamic, capability-aware referral destination cards.
   - Renders: Facility Name, Match Score (`/100`), Optimal Destination badge, Distance in km or schema note, Active Queue count, Clinical reasons, and Ineligibility warnings with explicit rejection rationale.

7. **`web/src/pages/FacilityReadiness.tsx`**
   - Removed hardcoded fallback `'Mokama, Bihar'` and static score `'88'`.
   - Now renders authentic address (`fac.address || 'Address not registered'`) and real PostgreSQL readiness score (`avail.readinessScore != null ? ... : 'Not recorded'`).

8. **`web/src/pages/PatientIntakeFlow.tsx`**
   - Enhanced Step 4 (Facility Routing & Referral) to dynamically display eligibility status, ineligibility reasons, and default selection to the top *eligible* destination candidate.

### Automated Test Suite
9. **`backend/tests/facility_routing.test.ts`**
   - Created comprehensive 38-scenario integration test suite covering the entire capability-aware routing lifecycle, input validation, and RBAC security.

---

## 3. MULTI-FACTOR CLINICAL ROUTING WEIGHTS & FORMULAS

### Base Formula
$$\text{Score} = \text{Base Score} (50) + \Delta \text{Readiness} + \text{Availability} + \text{Service Match} + \text{Specialty Match} + \text{Capacity Boosts} + \text{Urgency Suitability} - \text{Distance Penalty} - \text{Queue Penalty}$$

### Weight Matrix Configuration (`ROUTING_WEIGHTS`)

```typescript
export const ROUTING_WEIGHTS = {
  BASE_SCORE: 50,
  READINESS_FACTOR: 0.3, // (readinessScore - 50) * 0.3
  AVAILABILITY: {
    OPEN: 10,
    OVERCAPACITY_PENALTY: -25,
    CLOSED_PENALTY: -80,
  },
  SERVICE_MATCH_BOOST: 20,
  SPECIALTY_ON_SITE_DOCTOR_BOOST: 20,
  SPECIALTY_SERVICE_BOOST: 15,
  CAPACITY: {
    ICU_BED_AVAILABLE_BOOST: 12,
    GENERAL_BED_AVAILABLE_BOOST: 6,
    OXYGEN_BED_AVAILABLE_BOOST: 8,
    MATERNITY_BED_AVAILABLE_BOOST: 5,
    NICU_BED_AVAILABLE_BOOST: 8,
    ALL_CAPACITY_EXHAUSTED_PENALTY: -20,
  },
  LEVEL_BOOST: {
    LEVEL_3_TERTIARY: 10,
    LEVEL_2_SECONDARY: 5,
    LEVEL_1_PRIMARY: 0,
  },
  URGENCY: {
    EMERGENCY: {
      TERTIARY_BONUS: 15,
      ICU_REQUIRED_BONUS: 15,
      TRAUMA_CARE_BONUS: 10,
      DISTANCE_KM_PENALTY_RATE: 0.35, // High penalty for travel delay
    },
    URGENT: {
      SECONDARY_OR_TERTIARY_BONUS: 10,
      DISTANCE_KM_PENALTY_RATE: 0.20,
    },
    ROUTINE: {
      LOCAL_PRIMARY_BONUS: 10,
      QUEUE_PENALTY_MULTIPLIER: 1.5, // Stronger penalty for routine waiting
      DISTANCE_KM_PENALTY_RATE: 0.15,
    },
  },
  QUEUE: {
    ZERO_WAIT_BONUS: 5,
    PER_WAITING_PENALTY: 4,
    MAX_QUEUE_PENALTY: 25,
  },
  DEFAULT_KM_PENALTY_RATE: 0.20,
  ESTIMATED_SPEED_KMH: 40,
  MIN_TRAVEL_TIME_MINS: 5,
  MIN_SCORE: 15,
  MAX_SCORE: 99,
};
```

---

## 4. SCHEMA CAPABILITIES VS. REAL-WORLD LIMITATIONS TABLE

In compliance with the Phase 3 specification, missing or unsupported database fields are explicitly flagged with `NOT_SUPPORTED_BY_SCHEMA` and are never mocked, interpolated, or fabricated:

| Operational Dimension | In PostgreSQL Schema? | Handling Strategy | Return Value |
| :--- | :--- | :--- | :--- |
| **Facility Coordinates** | YES (`Facility.latitude`, `Facility.longitude`) | Evaluated via pure Haversine formula | Valid numeric degrees |
| **Patient Coordinates** | NO (`Patient` model lacks lat/long) | Passed in request payload (`patientLocation`) | `CALCULATED` if provided; `NOT_SUPPORTED_BY_SCHEMA` if absent |
| **Facility Services** | YES (`FacilityService` table) | Case-insensitive substring and exact match | `capabilityMatch.service: boolean` |
| **Specialist Coverage** | YES (`FacilityDoctor` -> `Doctor` -> `Specialist`) | Checked via relational join | `capabilityMatch.specialty: boolean` |
| **Bed Capacities** | YES (`FacilityCapacity` table) | Aggregated by resource category | Exact counts (`available = total - occupied`) |
| **Live Queue Load** | YES (`QueueEntry` table) | Live count of `WAITING`, `PRIORITY`, `IN_CONSULTATION` | Exact integer patient count |
| **Facility Operating Hours** | NO (No hours or schedule table) | Marked as schema limitation; assumes OPEN if status is OPEN | `NOT_SUPPORTED_BY_SCHEMA` |
| **Doctor Shift Schedules** | NO (No roster or shift table) | Matches assigned doctors in `FacilityDoctor` | `NOT_SUPPORTED_BY_SCHEMA` |
| **Real-time Road Traffic** | NO (No live maps telemetry) | Standard velocity formula: $(d / 40) \times 60$ minutes | Deterministic travel estimate |
| **Diagnostic Device Telemetry** | NO (No device status table) | Evaluated through registered `FacilityService` | `NOT_SUPPORTED_BY_SCHEMA` |

---

## 5. COMPLETE AUTOMATED TEST RESULTS & LOGS

### 1. Facility Routing Phase 3 Suite (`tests/facility_routing.test.ts`)
```
===============================================================
  AYUSYNC FACILITY ROUTING PHASE 3 VERIFICATION SUITE         
  REAL, DATABASE-BACKED, CAPABILITY-AWARE ROUTING ENGINE       
===============================================================

  [PASS] Scenario 1: Multi-actor Authentication: Verified tokens for CMO, Specialist Doctor, Patient, Frontline Worker
  [PASS] Scenario 2: Real PostgreSQL Facility Baseline Audit: Evaluated 5 genuine facilities across Levels 1, 2, and 3
  [PASS] Scenario 3: Basic Facility Routing: Returned 5 facilities with dual snake_case and camelCase identifiers
  [PASS] Scenario 4: Clinical Service Match Boost: fac-pune-dist received +20 service boost; fac-khandala-phc received 0
  [PASS] Scenario 5: Clinical Specialty Match Boost: fac-junnar-chc received +20 for assigned on-site Pediatrician Dr. Anand
  [PASS] Scenario 6: Facility Level Hierarchy: Tertiary +10, Secondary +5, Primary +0 baseline level suitability
  [PASS] Scenario 7: Emergency Urgency Prioritization: Ranked Level 3 District Hospital #1 with tertiary trauma suitability
  [PASS] Scenario 8: Routine Urgency Prioritization: Local primary facility received local care bonus
  [PASS] Scenario 9: Live Queue Load Penalty: Facilities with active waiting patients incurred proportional queue penalty
  [PASS] Scenario 10: Zero-Queue Idle Bonus: Facilities with 0 active patients received zero-wait bonus (+5)
  [PASS] Scenario 11: General Bed Availability Scoring Boost: Facilities with available general beds received +6 boost
  [PASS] Scenario 12: ICU Bed Availability Scoring Boost: fac-pune-dist (10 ICU beds available) received +12 boost
  [PASS] Scenario 13: Oxygen Bed Availability Scoring Boost: Facilities with available oxygen beds received +8 boost
  [PASS] Scenario 14: Maternity Bed Availability Scoring Boost: Facilities with available maternity beds received +5 boost
  [PASS] Scenario 15: NICU Bed Availability Scoring Boost: Facilities with available NICU beds received +8 boost
  [PASS] Scenario 16: Capability Exclusion (CLOSED): Facility with CLOSED status marked ineligible with explicit reason
  [PASS] Scenario 17: Capability Exclusion (EMERGENCY): PHCs lacking ICU/trauma capabilities marked ineligible for EMERGENCY urgency
  [PASS] Scenario 18: Capability Exclusion (Specialty): Facilities lacking Cardiology specialist marked ineligible with reason
  [PASS] Scenario 19: Capability Exclusion (Service): Facilities lacking Dialysis marked ineligible with explicit service reason
  [PASS] Scenario 20: Capability Exclusion (Bed Type): Facilities with 0 available ICU beds marked ineligible for ICU request
  [PASS] Scenario 21: Operational Status Penalty: OPEN grants +10; OVERCAPACITY imposes -25 penalty (35 point delta)
  [PASS] Scenario 22: Pure Haversine Distance Precision: Mumbai-Pune distance calculated as 120.2 km (expected ~119.5 km)
  [PASS] Scenario 23: Distance Penalty Scaling: EMERGENCY penalizes travel distance at 0.35/km vs ROUTINE at 0.15/km
  [PASS] Scenario 24: Unsupported Distance Handling: Missing coordinates return NOT_SUPPORTED_BY_SCHEMA without fabricating locations
  [PASS] Scenario 25: Complete Explainability Breakdown: Full mathematical factor breakdown and human-readable clinical reasons present
  [PASS] Scenario 26: CapabilityMatch Boolean Breakdown: Full 5-dimension boolean capability match flags verified
  [PASS] Scenario 27: Deterministic Ranking: Identical inputs produced identical scores and rankings across repeated calls
  [PASS] Scenario 28: Maximum Distance Radius Filter: Facilities beyond 25 km marked ineligible with distance radius violation
  [PASS] Scenario 29: Exclude Facility IDs Filter: Excluded specified facility IDs from candidate pool
  [PASS] Scenario 30: Limit Parameter Pagination: Returned top 2 candidates with primary vs alternative demarcation
  [PASS] Scenario 31: POST /api/facilities/route: Responded with HTTP 200, ranked_facilities array, and complete meta telemetry
  [PASS] Scenario 32: POST /api/ai/route: Responded with HTTP 200, preserved backward compatibility for frontline workflows
  [PASS] Scenario 33: Input Validation: Invalid urgency rejected with HTTP 400 Bad Request
  [PASS] Scenario 34: Input Validation: Out-of-bounds latitude (999) rejected with HTTP 400 Bad Request
  [PASS] Scenario 35: Input Validation: Invalid bed type rejected with HTTP 400 Bad Request
  [PASS] Scenario 36: RBAC Protection: Request without Bearer token rejected with HTTP 401 Unauthorized
  [PASS] Scenario 37: RBAC Protection: User token lacking facility.read permission rejected with HTTP 403 Forbidden
  [PASS] Scenario 38: Zero Database Mutations Verification: Confirmed DB row counts strictly unchanged (READ-ONLY)

===============================================================
  FACILITY ROUTING TEST RESULTS: 38 PASSED, 0 FAILED (TOTAL 38)
===============================================================
```

### 2. Facility Operations & RBAC Suite (`tests/facility_operations.test.ts`)
```
===============================================================
  FACILITY OPERATIONS PHASE 1 & 2 RESULTS: 22 PASSED, 0 FAILED
===============================================================
```

### 3. Doctor & Specialist Workflow Suite (`tests/doctor_workflow.test.ts`)
```
===============================================================
  DOCTOR & SPECIALIST WORKFLOW TEST RESULTS: 31 PASSED, 0 FAILED
===============================================================
```

### 4. ASHA & Frontline Worker Suite (`tests/asha_workflow.test.ts`)
```
===============================================================
  ASHA WORKFLOW TEST RESULTS: 31 PASSED, 0 FAILED
===============================================================
```

### 5. Patient Workflow Suite (`tests/patient_workflow.test.ts`)
```
===============================================================
  PATIENT WORKFLOW TEST RESULTS: 29 PASSED, 0 FAILED
===============================================================
```

**TOTAL SUITE PASS RATE:** **151 / 151 PASSED (100.0%)**

---

## 6. ZERO-MOCK AUDIT CERTIFICATION

An exhaustive static and runtime audit was conducted across the codebase:
1. **`Math.random` Verification:** 0 occurrences in `backend/src/modules/routing`, `backend/src/modules/facilities`, and `web/src/components/routing`.
2. **Static Operational Data:** Hardcoded queues (e.g. `queueLength: 0`) and static distance formulas (e.g. `(idx + 1) * 6.2`) have been removed and replaced by real PostgreSQL aggregations.
3. **Database Integrity:** Pre-test vs. Post-test table row counts verify zero accidental database modifications:
   - `Facility`: 5 rows (Unchanged)
   - `FacilityCapacity`: 14 rows (Unchanged)
   - `FacilityService`: 20 rows (Unchanged)
   - `QueueEntry`: 4 rows (Unchanged)
   - `Doctor`: 3 rows (Unchanged)
   - `Specialist`: 2 rows (Unchanged)

---

## 7. CONCLUSION

Phase 3 (Capability-Aware Facility Routing) is **100% complete, fully database-backed, explainable, mathematically sound, secure, and backwards-compatible**. All 151 regression and integration tests are green on localhost.

