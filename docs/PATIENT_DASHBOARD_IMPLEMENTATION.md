# AyuSync — Patient Dashboard Implementation Specification

## 1. Overview & Architecture

The **Patient Self-Service Portal** (`/patient`) in AyuSync provides citizens and patients in rural Maharashtra with complete access to their healthcare records, real-time consultation queue tracking, appointment scheduling, and care continuity tasks.

### Architecture Highlights
- **Role-Based Access Control (RBAC)**: Dedicated `PATIENT` role configured in PostgreSQL with least-privilege permissions (`patient.read`, `facility.read`, `referral.read`, `queue.read`).
- **Object-Level Authorization (IDOR Protection)**: Patient requests are bounded strictly to their authenticated `patientId`. Any attempt to access another patient's timeline returns `HTTP 403 Forbidden`.
- **Live Consultation Queue & Realtime Synchronization**: Socket.io event-driven queue token system (`TK-2026-xxx`) that broadcasts instant status transitions to both the patient's private channel (`patient_${patientId}`) and attending doctor room (`doctor_${doctorId}`).
- **Zero External URL Leakage**: Dynamic environment-driven API URLs via `VITE_API_URL` (local development binds to `http://localhost:5000/api`).

---

## 2. API Endpoint Matrix

All `/me/*` routes require standard JWT authentication and the `requirePatient` middleware:

| HTTP Method | Endpoint | Description | Guard |
|---|---|---|---|
| `GET` | `/api/patients/me` | Fetch authenticated patient profile & demographic record | `requirePatient` |
| `GET` | `/api/patients/me/timeline` | Fetch full medical encounter timeline for the authenticated patient | `requirePatient` |
| `GET` | `/api/patients/me/health-summary` | Summary of latest vitals, active conditions, encounters & referrals | `requirePatient` |
| `GET` | `/api/patients/me/appointments` | List all historical and upcoming appointments | `requirePatient` |
| `POST` | `/api/patients/me/appointments` | Book new appointment (with duplicate slot conflict rejection) | `requirePatient` |
| `DELETE` | `/api/patients/me/appointments/:id` | Cancel booked appointment (with cross-patient security check) | `requirePatient` |
| `POST` | `/api/patients/me/appointments/:id/arrive` | Check-in for appointment and issue live Consultation Queue token | `requirePatient` |
| `GET` | `/api/patients/me/queue` | Retrieve active queue status, token number, and wait position | `requirePatient` |
| `GET` | `/api/patients/me/referrals` | View hospital referrals and doctor counter-referral instructions | `requirePatient` |
| `GET` | `/api/patients/me/prescriptions` | View active medications prescribed across encounters | `requirePatient` |
| `GET` | `/api/patients/me/followups` | View assigned ASHA care continuity tasks and due dates | `requirePatient` |
| `GET` | `/api/diagnostics` | View diagnostic orders and laboratory results | `authenticate` |

---

## 3. Database Schema & Data Models

The patient workflow interacts with 8 PostgreSQL models managed via Prisma ORM:

1. **`User`**: Account identity (phone, hashed password, role relationship).
2. **`Role` & `Permission`**: Mapped via `_RolePermissions` junction table.
3. **`Patient`**: Demographics (name, dob, gender, phone, village, district, abhaId).
4. **`Appointment`**: Scheduled visits linked to `patientId`, `facilityId`, and `doctorId`.
5. **`QueueEntry`**: Real-time consultation queue tracker linked to `appointmentId` (`status: WAITING, IN_CONSULTATION, COMPLETED`).
6. **`Encounter` & `Observation`**: Clinical consultations, vital signs, and doctor diagnoses.
7. **`Prescription`**: Active medications, dosages, frequency, and instructions.
8. **`FollowUp`**: Care gap continuity alerts assigned to community ASHA workers.

---

## 4. Frontend Component Hierarchy (`web/src/pages/PatientDashboard.tsx`)

```
PageShell (Branded Header: Namaste, [Patient Name] | ABHA ID | Village)
 ├── Feedback Alerts (Check-in success banner, error banners)
 ├── Active Live Queue Banner (Gradient Card)
 │    ├── Token Number (e.g., TK-2026-043)
 │    ├── Facility & Assigned Doctor
 │    ├── Live Wait Position (e.g., Position 2)
 │    ├── Estimated Wait Time (~15 mins)
 │    └── Live StatusBadge (WAITING / IN_CONSULTATION)
 ├── Main Grid (2-Column Desktop Layout)
 │    ├── Left Column: Care Services & Workflows
 │    │    ├── Appointments Card (List, StatusBadge, Check-in & Cancel buttons)
 │    │    ├── Hospital Referrals & Counter-Referrals (Discharge instructions)
 │    │    └── Care Continuity & Follow-Up Tasks (Due dates, ASHA worker details)
 │    └── Right Column: Health Summary & Assistance
 │         ├── Latest Health Vitals Card (BP, Pulse, SpO2, Temperature)
 │         ├── Active Medications Card (Dosage, frequency, instructions)
 │         └── Emergency & Help Card (108 Ambulance, 104 Helpline, Baramati Desk)
 └── Book Consultation Modal
      ├── Healthcare Facility Dropdown
      ├── Date Picker (Min: Today)
      ├── Time Slot Selector (09:00 AM - 04:00 PM)
      └── Reason for Visit Input
```

---

## 5. Security & RBAC Enforcement

1. **Least-Privilege Role Assignment**:
   - `PATIENT` role only has read access to required entities (`patient.read`, `facility.read`, `referral.read`, `queue.read`).
   - Mutations on clinical records (`encounter.create`, `queue.manage`, `worker.write`) are strictly forbidden for patients (HTTP 403).
2. **IDOR & Parameter Tampering**:
   - `/api/patients/:id/timeline` verifies whether the requesting user is a `PATIENT`. If so, `id === req.user.patientId` is required.
   - Self-service endpoints derive `patientId` directly from the authenticated JWT session (`req.user.patientId`), making parameter injection impossible.
3. **Double Booking Prevention**:
   - Database checks prevent multiple active appointments for the same patient at identical time slots.

---

## 6. Real Data & Availability Enhancements

1. **Doctor Availability Service (`GET /api/appointments/availability`)**:
   - Validates facility operational readiness (`facility.availability.status !== 'CLOSED'`).
   - Resolves doctors assigned to the facility via `FacilityDoctor`.
   - Computes live slot conflicts for the target date against non-cancelled appointments.
   - Returns available and booked slots with explicit reasons.
2. **Doctor & Specialty Metadata**:
   - Centralized `formatDoctorName()` generates human-readable titles (e.g. `Dr. Rajesh Deshmukh`) from user email and doctor identifiers.
   - Attaches specialty (e.g. `Internal Medicine`) across appointments, queue entries, and availability responses.
3. **Authentic PostgreSQL Vitals**:
   - Real clinical measurements from table `"Vital"` are extracted into structured values (`BP: 136/86 mmHg`, `HR: 74 bpm`, `Blood Glucose: 186 mg/dL`) alongside recorded measurement timestamps (`4 Sep 2026`).
   - Unmeasured parameters explicitly reflect `Not recorded`, preventing fake mock fallbacks.
4. **Appointment Tier Segregation**:
   - Appointments are split into **Today's Active Clinic Consultations**, **Upcoming Appointments**, and **Past Consultations & Medical History**, completely eliminating historical noise.
5. **Laboratory Diagnostics Integration**:
   - Surfaces real pathology orders and test results (`HbA1c: 7.8%`, `Serum Creatinine: 1.1 mg/dL`, `Lipid Profile`, `CBC`) directly from `/api/diagnostics`.


