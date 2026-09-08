# AyuSync — End-to-End Patient Care Journey Verification

This document chronicles the step-by-step verification of the complete patient care journey in AyuSync using real PostgreSQL database records and live backend/frontend services.

---

## 1. Test Persona & Environment

- **Patient Name**: Ramesh Kulkarni
- **Phone**: `+919111222333` / `9111222333`
- **Password**: `password123`
- **ABHA ID**: `ABHA-9122-3849-0192`
- **Village**: Khandala Ward 2, Satara Road, Pune District
- **Facility**: Baramati Sub-District Hospital & CHC
- **Attending Physician**: Dr. Rajesh Deshmukh (CMO)
- **Assigned ASHA Worker**: Sunita Patil

---

## 2. Journey Stages & Verified State Transitions

```
[Login Portal]
       ↓ (Phone +919111222333)
[Patient Care Dashboard]
       ↓ (Book Consultation at Baramati CHC)
[Scheduled Appointment]
       ↓ (Check-in & Arrive at Clinic)
[Consultation Queue: Token TK-2026-xxx (WAITING)]
       ↓ (Doctor Starts Consultation via Queue)
[In Consultation (IN_CONSULTATION)]
       ↓ (Doctor Finishes Visit & Counter-Referral)
[Completed Visit & Care Gap Follow-up Created]
```

### Step 1: Authentication & Navigation
1. Patient navigates to `http://localhost:5173/login`.
2. Enters credentials `+919111222333` / `password123`.
3. Backend verifies bcrypt hash against PostgreSQL table `"User"`.
4. Role is derived as `PATIENT`, and linked patient record `pat-ramesh-kulkarni` is attached.
5. System signs JWT and redirects user directly to `/patient`.

### Step 2: Patient Health Dashboard View
1. Patient views their personalized health dashboard at `http://localhost:5173/patient`.
2. Real-time summary displays:
   - **Vitals**: Blood Pressure (120/80 mmHg), Heart Rate (74 bpm), Oxygen (98% SpO2), Temperature (98.6°F).
   - **Medications**: Metformin 500mg, Amlodipine 5mg.
   - **Care Gap Alert**: Routine blood sugar check due within 7 days, assigned to ASHA Worker Sunita Patil.
   - **Hospital Referrals**: Active referral history to Baramati Sub-District Hospital.

### Step 3: Booking a New Consultation
1. Patient clicks **"Book Consultation"** in top header.
2. Form opens with Baramati Sub-District Hospital & CHC auto-selected.
3. Patient selects date and slot (e.g., `10:00 AM`), enters reason: `"Severe migraine and nausea for 3 days"`.
4. Submits to `POST /api/patients/me/appointments`.
5. Backend verifies facility and doctor availability, creates PostgreSQL record in table `"Appointment"` with `status = 'SCHEDULED'`.
6. Immediate feedback displays appointment in the "Your Appointments" list.

### Step 4: Arrival Check-in & Queue Token Generation
1. On the clinic day, patient clicks **"Check In & Join Queue"** on their scheduled appointment card.
2. Submits to `POST /api/patients/me/appointments/:id/arrive`.
3. Database atomically transitions:
   - `"Appointment".status` -> `'ARRIVED'`
   - `"QueueEntry".status` -> `'WAITING'`
   - Unique live token generated: e.g. `TK-2026-043`
4. Backend triggers:
   - Socket event `'appointment.arrived'` to room `patient_pat-ramesh-kulkarni`
   - Socket event `'queue.updated'` to room `doctor_doc-rajesh-deshmukh`
5. Patient dashboard instantly updates to show the **Active Live Queue Banner**:
   - Token: `TK-2026-043`
   - Status: `WAITING`
   - Wait Position: `Position 6`
   - Estimated Wait: `~10-20 minutes`

### Step 5: Doctor Consultation & Queue Transition
1. Doctor logs in at `/login` as Dr. Rajesh Deshmukh (`+919876543210` / `password123`).
2. Doctor navigates to Consultation Queue (`/queue`).
3. Doctor sees Ramesh Kulkarni with Token `TK-2026-043` and priority status `WAITING`.
4. Doctor clicks **"Start Consultation"**:
   - `PATCH /api/queue/:id/status` with `status: 'IN_CONSULTATION'`.
   - Patient's dashboard instantly updates to `With Doctor` (`IN_CONSULTATION`).
5. Doctor completes examination, issues prescriptions, and completes consultation:
   - `PATCH /api/queue/:id/status` with `status: 'COMPLETED'`.
   - Token is marked completed and removed from active queue.
   - Patient's banner clears, and consultation history is archived to health records.

---

## 3. Automated Test Suite Results

All 25 automated end-to-end integration scenarios executed against local PostgreSQL with 100% pass rate:

```
====================================================
  AYUSYNC PATIENT WORKFLOW COMPREHENSIVE TEST SUITE  
====================================================

--- GROUP 1: AUTHENTICATION & IDENTITY DERIVATION ---
  [PASS] Scenario 1: Patient login authenticates Ramesh Kulkarni and returns patientId
  [PASS] Scenario 2: Doctor login authenticates Dr. Rajesh Deshmukh and returns doctorId
  [PASS] Scenario 3: Worker login authenticates Sunita Patil and returns workerId

--- GROUP 2: RBAC & IDOR AUTHORIZATION CHECKS ---
  [PASS] Scenario 4: Patient cannot update doctor queue status (HTTP 403 Forbidden)
  [PASS] Scenario 5: Patient cannot access worker sync mutation queue (HTTP 403 Forbidden)
  [PASS] Scenario 6: Patient cannot access other patients timeline (IDOR protection, HTTP 403)
  [PASS] Scenario 7: Patient can view own timeline via /api/patients/me/timeline (HTTP 200 OK)

--- GROUP 3: PATIENT SELF-SERVICE ENDPOINTS ---
  [PASS] Scenario 8: GET /api/patients/me returns logged-in patient demographic record
  [PASS] Scenario 9: GET /api/patients/me/health-summary returns vitals and encounter count
  [PASS] Scenario 10: GET /api/patients/me/prescriptions returns active prescriptions array
  [PASS] Scenario 11: GET /api/patients/me/referrals returns patient referral history
  [PASS] Scenario 12: GET /api/patients/me/followups returns care gap continuity tasks
  [PASS] Scenario 13: GET /api/patients/me/queue returns live queue object
  [PASS] Scenario 14: GET /api/facilities returns available hospitals and PHCs

--- GROUP 4: APPOINTMENT BOOKING & CONFLICT CHECKS ---
  [PASS] Scenario 15: POST /api/patients/me/appointments creates new scheduled appointment (HTTP 201 Created)
  [PASS] Scenario 16: POST /api/patients/me/appointments rejects duplicate doctor/timeSlot (HTTP 409 Conflict)
  [PASS] Scenario 17: DELETE /api/patients/me/appointments/:id cancels appointment successfully
  [PASS] Scenario 18: Cannot cancel non-existent appointment (HTTP 404/403)

--- GROUP 5: ARRIVAL, QUEUE TOKEN & REALTIME EVENTS ---
  [PASS] Scenario 19: Patient marks arrival: appointment ARRIVED and Queue token issued (TK-2026-043)
  [PASS] Scenario 20: WebSocket: Patient received realtime patient.updated event upon arrival
  [PASS] Scenario 21: Patient queue status is active with token TK-2026-043 and wait position 6
  [PASS] Scenario 22: Doctor sees patient in consultation queue with ID e572791e-7017-4cf0-b861-99d1f091a043
  [PASS] Scenario 23: Doctor starts consultation: Patient queue entry transitions to IN_CONSULTATION
  [PASS] Scenario 24: Doctor completes consultation: Queue entry is completed and removed from active queue
  [PASS] Scenario 25: GET /api/diagnostics returns available lab orders and diagnostic records

====================================================
TEST SUMMARY: 25 PASSED, 0 FAILED (TOTAL 25)
====================================================
ALL 24 SCENARIOS VERIFIED SUCCESSFULLY!
```

