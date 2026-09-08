# AyuSync — Patient Portal UI/UX Audit & Refinement Blueprint

**Target Repository:** `/home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean`  
**Focus:** Patient Self-Service Experience (`/patient`, `App.tsx`, `Login.tsx`)  
**Design Philosophy:** "Patient Care Control Center" rather than a "Database Information Dashboard"  
**Audit Date:** September 8, 2026  

---

## 1. Executive Summary & Problem Definition

The AyuSync patient portal is fully backed by real PostgreSQL 15.19 data, robust RBAC, and real-time Socket.io events. However, the current visual interface presents significant cognitive load and information overload for citizens in rural Maharashtra:

- **11 Competing Cards**: The homepage simultaneously renders the active queue banner, active appointments card, upcoming appointments card, past consultations accordion, diagnostic laboratory card, referrals card, follow-up care gaps card, vitals card, diagnosed conditions tag cloud, medications card, and emergency assistance card.
- **Competing Call-to-Actions (CTAs)**: Up to 4 high-contrast green buttons appear simultaneously on the same viewport ("Book Consultation" header, "Schedule Clinic Visit" empty queue, "Check In & Join Queue" appointment, "Book Appointment" empty list).
- **Missing Progressive Disclosure**: Comprehensive historical details (such as past cancelled visits, discharge summaries, and complete laboratory lists) are forced onto the primary landing page instead of being accessible through contextual secondary views.
- **Mobile Navigation Mismatch**: `App.tsx`'s mobile bottom navigation defaulted to Doctor navigation items (`Queue`, `Continuity`, `Patients`) when logged in with the `PATIENT` role.

---

## 2. Comprehensive UI/UX Inventory & Defect Classification

| Dimension | Current Observation (As-Is) | Problem / User Impact | Required Remediation (To-Be) |
|---|---|---|---|
| **Primary Focus & Next Action** | Multiple cards scream for attention. If a patient is waiting in queue, the queue banner is followed by 8 other large cards below it. | Patient has to hunt through the screen to figure out: *"What do I need to do right now?"* | **Dedicated Care Status Hero**: Single dominant state card. If in queue, highlight Live Queue Token & position. If appointment today, highlight Check-In. If none, highlight next appointment with single dominant CTA. |
| **Appointment Display** | 3 separate cards/accordions for Active, Upcoming, and Past appointments taking up 60%+ of left column. | Overwhelming list; past medical history clutters routine daily visits. | **Next Appointment Spotlight**: Show *only* the single most relevant active or upcoming visit on dashboard. Provide a clean modal/tab for "View All Appointments & History". |
| **Health Vitals** | 4 large boxes with labels, values, units, and status badges, plus a chronic conditions tag cloud. | Occupies massive vertical space on right sidebar; looks like a medical telemetry monitor. | **Compact Health Snapshot**: Single streamlined card with 4 clean metrics (`BP 136/86`, `Pulse 74 bpm`, `Glucose 186 mg/dL`, `SpO2 98%`) and measurement date, with "View Health Record" link. |
| **Care Tasks & Follow-ups** | Separate cards for Follow-ups, Referrals, and Diagnostics scattered across both columns. | Disjointed care actions; user cannot see holistic pending requirements in one scan. | **Unified "Care Actions" Center**: Consolidates pending ASHA follow-ups, pending lab tests, and referral actions into concise, scannable rows with specific action buttons. |
| **Medications** | Standalone card with detailed multi-line instructions for each prescription. | Pushes critical emergency and contact information far below the fold. | **Active Medications Preview**: Compact rows with medicine name, dosage, and frequency, with "View All Medications" drawer/modal. |
| **Referrals** | Standalone card taking full width or large column space even if only 1 referral exists. | Excessive whitespace and repeated hospital labels. | **Contextual Referral Card**: Only renders when an active referral requires patient attention, or presents a 1-line compact summary. |
| **Diagnostics** | Full diagnostic list with test names, abnormal tags, and sample pending status rendered inline. | Lab reports belong in medical history, not primary home feed. | **Diagnostics Spotlight**: Show only tests requiring attention (e.g. `HbA1c 7.8% · Abnormal` or `CBC · Pending`), with "View All Reports" modal. |
| **Care Journey / Timeline** | Longitudinal history mixed across multiple cards. | Patient cannot see their chronological care progression. | **Recent Care Journey Preview**: Compact 3-step vertical stepper showing latest consultation, diagnostics, and prescriptions. |
| **Emergency Help** | Large boxed green card taking significant sidebar space. | Competes visually with routine appointment booking and clinical advice. | **Streamlined Emergency Bar**: Compact footer/bottom helpline bar with 108 Ambulance, 104 Healthline, and clinic phone. |
| **Mobile Navigation** | Bottom bar in `App.tsx` did not differentiate `PATIENT` role, showing doctor items. | Broken patient navigation on mobile phones (360px–414px). | **Patient-Specific Mobile Nav**: Clean 3-tab bottom bar (`My Care`, `Health Record`, `Clinic Status`) with thumb-friendly touch targets. |

---

## 3. New Information Hierarchy Architecture

The redesigned Patient Care Control Center strictly answers five user questions in linear order:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. WHAT DO I NEED TO DO NOW?                                            │
│    👉 Live Consultation Queue Token OR Today's Check-In OR Next Step    │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. WHAT IS MY NEXT APPOINTMENT?                                         │
│    👉 Single Next Scheduled Visit (Doctor, Specialty, Date, Time)       │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. WHAT IS MY CURRENT HEALTH STATUS?                                    │
│    👉 Compact Health Snapshot (BP, Heart Rate, Glucose, SpO2)            │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. IS THERE ANYTHING I NEED TO FOLLOW UP?                               │
│    👉 Unified Care Actions (Pending ASHA tasks, pending labs, referral) │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. WHERE CAN I SEE MY COMPLETE HISTORY?                                 │
│    👉 Progressive Disclosure: Dedicated Modals & Longitudinal Views     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Progressive Disclosure Specifications

| Section on Dashboard | Inline Summary on Home | Detailed View (Modal / Dedicated Route) |
|---|---|---|
| **Appointments** | Next upcoming visit with status & Check-in / Cancel action | **All Appointments Modal**: Tabs for Active, Upcoming, Past with token history and cancellation |
| **Health Vitals** | 4-point compact snapshot with measurement date | **Full Health Record (`/patients/:id`)**: Longitudinal encounter history, condition timeline |
| **Care Actions** | Top 3 urgent tasks (due today, pending lab, referral) | **Care Continuity View**: Complete task descriptions, notes from ASHA worker Sunita Patil |
| **Medications** | Top active medications with dosage & frequency | **All Medications Modal**: Complete prescription history, food instructions, duration |
| **Diagnostics** | Pending tests & abnormal results only | **Laboratory Reports Modal**: Complete diagnostic tests with numerical results & ranges |
| **Referrals** | Active transfer status & destination hospital | **Referral Tracking Modal**: Transfer timeline, counter-referral advice, doctor notes |
| **Care Journey** | 3-step recent milestone summary | **Complete Journey Timeline**: Comprehensive chronologically sorted patient timeline |

---

## 5. Responsive Design & Mobile Grid Matrix

- **Desktop (1024px – 1440px)**:
  - 2-Column asymmetrical grid (2/3 Left: Care Status, Next Appointment, Care Actions, Care Journey; 1/3 Right: Health Snapshot, Active Medications, Emergency Strip).
- **Tablet (768px – 1023px)**:
  - Single column with paired 2-column sub-cards for Health Snapshot and Care Actions.
- **Mobile (360px – 414px)**:
  - Strict 1-column vertical flow with 16px horizontal margins.
  - Zero horizontal scrolling or clipped text.
  - Minimum touch target 44px x 44px for all buttons and interactive chips.
  - Sticky or fixed bottom navigation bar for instantaneous 1-thumb access.

---

## 6. Implementation Plan & Deliverables

1. **Refactor `web/src/pages/PatientDashboard.tsx`**:
   - Implement the 5-tier information hierarchy.
   - Consolidate CTAs to avoid competing visual noise.
   - Build unified "Care Actions" section combining follow-ups, pending labs, and referral items.
   - Build compact Health Snapshot.
   - Add progressive disclosure modals for:
     - All Appointments & History
     - All Prescriptions & Directions
     - All Diagnostic Laboratory Reports
     - Referral Details & Discharge Instructions
2. **Refactor `web/src/App.tsx`**:
   - Add role-aware mobile navigation bar specifically for `PATIENT` role (`My Care`, `Health Record`, `Clinic Status`).
   - Clean up top navigation items to avoid clutter.
3. **Verify Integrity**:
   - `npm run lint` with 0 warnings.
   - `npm run build` with clean bundle.
   - Full 29-scenario integration test pass (`patient_workflow.test.ts`).
