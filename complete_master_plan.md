# AyuSync — Complete Master Implementation Plan
## SIH 2026 | Rural & Underserved Healthcare Access, Continuity & Quality Platform

**Document status:** Master Source of Truth  
**Implementation target:** 100% verifiable completion  
**Scope:** Backend + Web + Flutter + AI/ML + Agentic AI + Offline + Realtime + Analytics + Interoperability + Security + Testing + SIH Demo

---

# 1. Executive Vision

AyuSync is an **integrated care-access and continuity platform for rural and underserved healthcare**.

The goal is not to replace India's public-health infrastructure or existing government platforms. The goal is to build a **coordination, intelligence and continuity layer around the existing system** so that a patient's journey does not break between:

**Community → Sub-centre/HWC → PHC → CHC/Rural Hospital → District/Specialist Care → Diagnostics/Medicines → Follow-up → Closure**

AyuSync must strengthen:

- timely access
- continuity of information
- referral completion
- follow-up
- specialist access
- diagnostic coordination
- medicine visibility
- frontline-worker efficiency
- facility readiness
- operational accountability

The platform must work under:

- low connectivity
- intermittent connectivity
- multilingual environments
- limited digital literacy
- constrained staffing
- limited equipment
- fragmented care journeys

---

# 2. Problem We Are Solving

The core problem is not simply "lack of a telemedicine application."

Existing digital health infrastructure already provides significant capabilities such as telemedicine, e-prescriptions, specialist connectivity, dashboards, medicine visibility and digital health interoperability.

AyuSync therefore focuses on the **gaps between services**:

1. A patient is assessed but the referral is not completed.
2. A referral is created but the receiving facility does not act quickly.
3. A patient reaches another facility without adequate context.
4. A diagnostic test is ordered but the result does not reconnect to the care journey.
5. A patient receives treatment but nobody tracks the next required action.
6. A follow-up becomes overdue without escalation.
7. A facility appears available but its operational information is stale.
8. A worker is forced to work online despite poor connectivity.
9. AI can recommend something but the recommendation is not explainable or auditable.
10. Data exists but the system cannot convert it into operational action.

AyuSync is designed around one central concept:

> **Do not merely digitize healthcare events. Make the entire care journey observable, actionable and recoverable.**

---

# 3. What Makes AyuSync Different

AyuSync must not be presented as "another telemedicine app."

The differentiating layer is:

## 3.1 Closed-Loop Care Journey

Instead of:

**Referral Created → Done**

AyuSync tracks:

**Need identified → triage → routing → appointment → queue → consultation → diagnostics → treatment → referral → receiving facility → counter-referral → follow-up → care-gap detection → closure**

Every unresolved step becomes visible.

---

## 3.2 Care Journey Reliability Engine

AyuSync continuously asks:

- What is pending?
- What is stuck?
- Who owns the next action?
- How urgent is it?
- How long has it been waiting?
- What should happen next?
- What happens if nobody acts?

This converts a passive record system into an **action-oriented continuity system**.

---

## 3.3 Facility Readiness + Freshness

A facility should not simply be marked "available."

AyuSync calculates operational readiness using:

- service availability
- specialist availability
- capacity
- diagnostic availability
- medicine availability
- emergency capability
- queue load
- freshness of the underlying information

Every operational recommendation should show when the information was last updated.

---

## 3.4 Explainable Intelligent Routing

Instead of:

> "Go to Facility A."

AyuSync should say:

> Facility A ranked first because required specialty is available, emergency capability is compatible, current capacity is acceptable, estimated waiting time is lower and the information is recently refreshed.

Hard constraints and soft ranking factors remain visible.

---

## 3.5 Offline-First Frontline Care

The system must assume connectivity can disappear.

Core frontline workflows continue locally:

**Capture → Save locally → Queue → Reconnect → Sync → Resolve conflicts**

Offline is not an error state. It is a normal operating mode.

---

## 3.6 Safe AI, Not Autonomous Medicine

AI provides decision support.

AI must:

- explain recommendations
- expose confidence
- identify missing information
- identify risk factors
- show provenance
- require human confirmation for consequential clinical actions
- fail safely

AI must never silently diagnose or autonomously make irreversible clinical decisions.

---

## 3.7 Controlled Agentic Operations

The agent is an operational assistant, not an unrestricted autonomous doctor.

It follows:

**OBSERVE → PLAN → EXECUTE → VALIDATE → AUDIT**

The agent has allowlisted tools and no direct database access.

Consequential actions can require:

**PENDING_APPROVAL → APPROVED → EXECUTED**

---

## 3.8 Predictive Operations

AyuSync should move from:

> "What is happening?"

to:

> "What is likely to happen next, and what can the facility do about it?"

Examples:

- medicine stockout risk
- diagnostic demand forecast
- expected operational load

Predictions must always remain explicitly labelled as predictions.

---

# 4. Design Principles

1. Public-health-system first
2. Human-in-the-loop
3. Offline-first
4. Privacy-by-design
5. Interoperability-by-design
6. Explainability-by-default
7. Auditability
8. Least-privilege access
9. No fake integrations
10. No hardcoded business outcomes
11. Real database-backed workflows
12. Graceful degradation
13. Multilingual and low-literacy friendly
14. Accessibility
15. Evidence-driven completion
16. Every workflow must have an owner and next action

---

# 5. System Architecture

```text
                    ┌─────────────────────────────┐
                    │        AyuSync Web          │
                    │ Worker / Doctor / Admin     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       AyuSync Flutter       │
                    │ Offline Frontline App       │
                    └──────────────┬──────────────┘
                                   │
                         HTTPS / WebSocket
                                   │
              ┌────────────────────▼────────────────────┐
              │             Node.js Backend              │
              │ Auth / RBAC / Clinical / Workflow / API │
              └───────┬───────────┬───────────┬─────────┘
                      │           │           │
              ┌───────▼────┐ ┌────▼─────┐ ┌──▼──────────┐
              │ PostgreSQL │ │ Redis /  │ │ Background  │
              │ + Prisma   │ │ Events   │ │ Jobs        │
              └────────────┘ └──────────┘ └─────────────┘
                      │
              ┌───────▼────────────────────────┐
              │       Python AI Service        │
              │ Triage / Routing / Prediction  │
              │ Agent / Safety / Validation    │
              └──────────────┬─────────────────┘
                             │
              ┌──────────────▼─────────────────┐
              │ Interoperability Adapter Layer │
              │ ABDM/ABHA/FHIR-ready boundary  │
              └─────────────────────────────────┘
```

---

# 6. Backend Master Plan — 24 Phases

## Phase 1 — Architecture, Configuration & Database Foundation

Implement:

- modular backend structure
- configuration management
- environment validation
- Prisma
- PostgreSQL
- migrations
- seed system
- error architecture
- shared utilities

Required domain entities:

- User
- Role
- Worker
- Doctor
- Specialist
- Facility
- Patient
- Consent
- Encounter
- Assessment
- Symptom
- Vital
- Condition
- Medication
- Prescription
- DiagnosticOrder
- DiagnosticResult
- Appointment
- QueueEntry
- Referral
- CounterReferral
- FollowUp
- Task
- Notification
- AIRecommendation
- AuditLog
- SyncOperation
- ExternalReference
- prediction-related records where required

Requirements:

- proper relationships
- constraints
- indexes
- timestamps
- versioning where required
- audit metadata
- provenance

Acceptance:

- migration succeeds
- schema validates
- seed works
- all workflows persist real data

---

## Phase 2 — Authentication & RBAC

Roles:

- Worker
- Doctor
- Specialist
- Facility Admin
- District/Quality Admin

Implement:

- secure login
- password hashing
- JWT/session handling
- token expiry
- refresh/re-authentication strategy
- RBAC
- object-level authorization
- facility-level isolation
- IDOR prevention

Acceptance:

Unauthorized users cannot access protected patient/facility resources.

---

## Phase 3 — Patient Identity & Longitudinal Record

Implement:

- registration
- search
- profile
- identity matching
- duplicate prevention
- longitudinal history
- encounter timeline
- provenance

Acceptance:

One patient can be followed across multiple encounters and facilities without losing continuity.

---

## Phase 4 — Assessment & Vitals

Capture:

- symptoms
- duration
- severity
- vitals
- history
- risk indicators
- notes
- provenance

Validate:

- ranges
- required fields
- abnormal values
- missing information

---

## Phase 5 — Facilities, Doctors & Specialists

Facility capabilities:

- services
- specialties
- emergency capability
- diagnostics
- medicines
- capacity
- availability
- freshness
- operating status

Doctors/specialists:

- specialty
- schedule
- facility
- availability
- consultation capacity

---

## Phase 6 — Appointments & Queue

Implement:

- schedules
- slots
- availability
- booking
- cancellation
- rescheduling
- concurrency protection
- queue creation
- queue priority
- explicit queue states

Required queue states include:

- WAITING
- PRIORITY
- IN_CONSULTATION
- COMPLETED
- CANCELLED

Acceptance:

Two concurrent bookings cannot consume the same slot.

---

## Phase 7 — Referral State Machine

Implement strict transitions:

```text
CREATED
→ SUBMITTED
→ ACCEPTED
→ SCHEDULED
→ PATIENT_ARRIVED
→ IN_CONSULTATION
→ COMPLETED
```

Alternative states:

- REJECTED
- CANCELLED

Every invalid transition must be rejected.

Track:

- urgency
- reason
- destination
- owner
- timestamps
- SLA/age
- acceptance
- arrival
- completion

---

## Phase 8 — Counter-Referral & Follow-up

Counter-referral contains:

- outcome
- treatment
- instructions
- next action
- follow-up date

Follow-up:

- PENDING
- IN_PROGRESS
- COMPLETED
- OVERDUE

Counter-referral must automatically feed downstream continuity workflows.

---

## Phase 9 — Notifications & Background Jobs

Implement:

- reminders
- referral notifications
- follow-up notifications
- care-gap scans
- missed appointment checks
- retry strategy
- failure logging

Use a robust job architecture such as BullMQ/Redis or a carefully scoped scheduler.

---

## Phase 10 — Realtime Event System

Implement authenticated Socket.IO events.

Events:

- patient.created
- assessment.completed
- triage.completed
- queue.updated
- referral.updated
- followup.updated
- notification.created

Verify actual:

Backend event → client event → frontend state update.

---

## Phase 11 — Offline Sync & Idempotency

Implement:

- operationId
- idempotency key
- batch mutations
- sync endpoint
- local queue
- retry
- duplicate prevention
- partial batch results

Results:

- SUCCESS
- CONFLICT
- ERROR

---

## Phase 12 — Conflict Resolution

Do not blindly use last-write-wins.

Use:

- append-only treatment/event records where appropriate
- entity versioning
- field-level merge where safe
- explicit conflict detection
- human merge UI where required

---

## Phase 13 — AI Service Integration

Node ↔ Python boundary must use strict schemas.

Implement:

- request validation
- response validation
- timeout
- safe fallback
- provider abstraction
- audit
- correlation IDs

No raw model output directly mutates clinical state.

---

## Phase 14 — Explainable AI Triage

Implement:

**POST /triage**

Inputs:

- symptoms
- duration
- severity
- vitals
- age
- history
- risk indicators
- encounter context

Outputs:

- ROUTINE
- PRIORITY
- URGENT
- confidence
- reasons
- risk factors
- missing information
- next action
- escalation recommendation
- provenance
- rule/model version

Use a safety-first decision-support baseline.

---

## Phase 15 — Intelligent Routing

Implement:

**POST /route**

Hard constraints:

- specialty
- capability
- emergency capability
- availability

Soft ranking:

- distance
- waiting time
- capacity
- diagnostics
- medicines
- readiness
- freshness

Output:

- ranked facilities
- score
- constraint results
- explanation
- alternatives

---

## Phase 16 — Care-Gap Engine

Detect:

- stuck referrals
- overdue follow-ups
- missed appointments
- missing diagnostic results
- incomplete care journeys

Workflow:

```text
Gap detected
→ priority calculated
→ task created
→ owner assigned
→ notification
→ escalation if unresolved
```

---

## Phase 17 — Controlled Agentic AI

Implement:

```text
OBSERVE
   ↓
PLAN
   ↓
EXECUTE
   ↓
VALIDATE
   ↓
AUDIT
```

Allowlisted tools:

- get_patient_context
- get_referral_status
- get_followup_status
- find_facilities
- create_followup
- create_task
- notify_worker

No direct DB access.

Consequential actions:

```text
PENDING_APPROVAL
→ APPROVED
→ EXECUTED
```

or:

```text
PENDING_APPROVAL
→ REJECTED
```

Every agent run is auditable.

---

## Phase 18 — Facility Analytics

Actual metrics:

- patient volume
- queue load
- waiting time
- referral volume
- referral completion
- follow-up completion
- facility utilization
- readiness

No hardcoded dashboard values.

---

## Phase 19 — Predictive Operations

Implement locally runnable prediction baselines.

Minimum:

1. medicine stockout risk
2. diagnostic demand prediction

Every result contains:

- ACTUAL / PREDICTED label
- generated timestamp
- model/version
- horizon
- confidence/risk where applicable
- input window

Predictions must never be represented as facts.

---

## Phase 20 — Interoperability

Implement adapter boundary:

```text
AyuSync Internal Model
        ↓
Interoperability Adapter
        ↓
Standardized Representation
        ↓
External/Sandbox Gateway
```

FHIR-aligned mappings where appropriate:

- Patient
- Encounter
- Observation
- Condition
- MedicationRequest
- DiagnosticReport
- ServiceRequest
- Appointment
- Task/CarePlan where appropriate

Implement sandbox adapter and validation.

Live government gateway remains credential-dependent and must never be faked.

---

## Phase 21 — Security Hardening

Implement:

- secure headers
- CORS policy
- rate limiting
- request validation
- input sanitization
- secret management
- authorization
- audit logging
- sensitive-data minimization
- error-safe responses

---

## Phase 22 — Observability

Implement:

- structured logs
- request IDs
- correlation IDs
- health endpoints
- AI tracing
- sync tracing
- job tracing
- security events
- workflow audit

---

## Phase 23 — Testing

Test:

- unit
- integration
- API
- state machine
- concurrency
- sync
- conflict
- AI
- agent
- security
- realtime
- care gaps
- notifications

---

## Phase 24 — SIH Demo Readiness

Provide:

- realistic seed dataset
- rural facilities
- workers
- doctors
- specialists
- patients
- queues
- referrals
- diagnostic records
- medicines
- follow-ups
- care gaps

Seed data must go through actual application logic.

---

# 7. Frontend Master Plan — 20 Phases

## Phase 1 — Foundation

Web:

- React/Vite
- Tailwind/design system
- routing
- authentication
- role-based navigation

Flutter:

- Riverpod/provider architecture
- routing
- secure storage
- reusable components

---

## Phase 2 — Patient Management

Implement:

- worker dashboard
- doctor dashboard
- patient registration
- patient search
- profile
- history
- timeline

---

## Phase 3 — Assessment & Vitals

Fast frontline-friendly forms.

Support:

- symptoms
- duration
- severity
- vitals
- history
- validation
- provenance

---

## Phase 4 — Offline Local Database

Web:

- Dexie/IndexedDB

Flutter:

- sqflite

Store:

- patients
- encounters
- assessments
- pending mutations

---

## Phase 5 — Sync & Conflict UX

Implement:

- connectivity status
- sync status
- pending count
- retries
- conflict screen
- merge/resolution flow
- Sync Center

---

## Phase 6 — Doctor Dashboard & Queue

Implement:

- queue
- priority
- patient context
- consultation workspace
- longitudinal history
- live updates

---

## Phase 7 — Realtime

Socket.IO client.

No manual refresh required for supported live events.

---

## Phase 8 — Appointments

Implement:

- slot browsing
- availability
- booking
- rescheduling
- cancellation
- conflict handling

---

## Phase 9 — Referral UI

Show:

- reason
- urgency
- destination
- timeline
- status
- SLA/age
- next action

---

## Phase 10 — Counter-Referral & Follow-up

Doctor:

- notes
- diagnosis
- prescription
- treatment
- counter-referral

Worker:

- follow-up inbox
- task
- due date
- overdue status
- completion

---

## Phase 11 — AI Triage UI

Display:

- urgency
- confidence
- reasons
- missing information
- risk
- recommended next action

---

## Phase 12 — AI Explanation & Provenance

Use visible provenance badges:

- Worker recorded
- Doctor recorded
- AI generated
- Imported
- Synchronized

AI recommendations require human confirmation where appropriate.

---

## Phase 13 — Intelligent Routing UI

Show:

- ranked facilities
- score
- distance
- specialty
- capacity
- diagnostics
- medicine availability
- readiness
- freshness
- explanation
- alternatives

---

## Phase 14 — Facility Readiness

Dashboard:

- readiness score
- services
- specialists
- diagnostics
- medicines
- capacity
- freshness

---

## Phase 15 — Care-Gap UI

Display:

- stuck referrals
- overdue follow-ups
- missing diagnostics
- missed appointments
- priority
- owner
- deadline
- escalation
- recommended next action

---

## Phase 16 — Voice & Multilingual

Implement:

- SpeechAdapter
- transcription
- review-before-save
- language switching
- translation keys
- localization architecture

Never save unreviewed transcription as authoritative clinical data.

---

## Phase 17 — Admin Analytics

Display actual:

- patient volume
- queues
- waiting time
- referrals
- follow-ups
- facility load

---

## Phase 18 — Predictive Operations

Display:

**ACTUAL**

separately from:

**PREDICTED**

Minimum:

- stockout risk
- diagnostic demand

Include timestamps and prediction horizons.

---

## Phase 19 — Security, Accessibility & Performance

Implement:

- keyboard navigation
- screen-reader labels
- responsive design
- lazy loading/code splitting
- loading states
- error states
- empty states
- permission states
- offline states
- AI failure states
- sync failure states

---

## Phase 20 — Final Demo Flow

The complete SIH flow must work without manual database manipulation.

---

# 8. Flutter Mobile Master Scope

The Flutter application is the frontline worker's operational companion.

Required screens:

1. Login
2. Dashboard
3. Patient Registration
4. Patient Search
5. Patient Profile
6. Assessment
7. Vitals
8. Encounter
9. AI Triage Result
10. Referral
11. Follow-up Inbox
12. Notifications
13. Offline Queue
14. Sync Center
15. Conflict Resolution
16. Settings/Language

Offline acceptance:

```text
Disconnect network
→ register patient
→ assessment
→ save
→ close/reopen app
→ data remains
→ reconnect
→ sync
→ backend persistence
→ duplicate prevention
```

---

# 9. AI/ML Master Architecture

## AI Components

### Triage Engine

Combines:

- validated clinical input
- safety rules
- risk rules
- optional model/LLM provider
- explanation layer

### Routing Engine

Combines:

- hard constraints
- operational ranking
- facility freshness

### Prediction Engine

Supports:

- stockout risk
- diagnostic demand

### Agent Engine

Controls operational workflows.

---

# 10. Model Provider Abstraction

The AI layer must support provider replacement.

```text
ModelProvider
├── generate()
├── validate()
├── metadata()
└── health()
```

Potential providers can be connected later without rewriting business logic.

External provider failure must not make the entire healthcare workflow unusable.

---

# 11. Agent Safety Architecture

Agent permissions must be explicit.

Example:

```text
READ:
✓ get_patient_context
✓ get_referral_status
✓ get_followup_status
✓ find_facilities

WRITE:
! create_followup
! create_task
! notify_worker
```

Every write action passes through authorization and, where required:

**Human Approval Gate**

---

# 12. Care Journey State Model

AyuSync should maintain a logical journey:

```text
PATIENT NEED
    ↓
ASSESSMENT
    ↓
TRIAGE
    ↓
ROUTING
    ↓
APPOINTMENT
    ↓
QUEUE
    ↓
CONSULTATION
    ↓
DIAGNOSTICS
    ↓
TREATMENT
    ↓
REFERRAL
    ↓
RECEIVING FACILITY
    ↓
COUNTER-REFERRAL
    ↓
FOLLOW-UP
    ↓
CARE-GAP MONITORING
    ↓
COMPLETION
```

At every point:

- current state
- owner
- urgency
- next action
- age
- evidence
- escalation

must be discoverable.

---

# 13. Data Provenance

Important data must identify its origin.

Examples:

- HUMAN_ENTERED
- WORKER_RECORDED
- DOCTOR_RECORDED
- AI_GENERATED
- IMPORTED
- SYNCHRONIZED

This enables safer clinical review and auditing.

---

# 14. Privacy & Consent

Implement:

- consent records
- purpose-aware access where applicable
- least privilege
- audit trail
- limited data collection
- secure transport
- secure storage
- anonymization strategy for analytics/research use
- patient-data isolation

No analytics module should expose unnecessary personally identifiable health information.

---

# 15. Notification Strategy

Notification hierarchy:

1. In-app notification
2. Worker task
3. Escalation
4. External provider adapter when configured

External push providers must never be falsely represented as successfully delivering messages.

---

# 16. Predictive Operations Design

## Medicine Stockout Risk

Inputs may include:

- historical consumption
- current stock
- replenishment pattern
- demand trend
- facility load

Output:

- risk level
- predicted depletion window
- confidence/uncertainty
- recommended operational attention

## Diagnostic Demand

Inputs may include:

- historical diagnostic orders
- recent trends
- facility load
- seasonal/time patterns where appropriate

Output:

- expected demand
- horizon
- confidence/uncertainty

---

# 17. Facility Readiness Model

Example conceptual score:

```text
Readiness =
  Service Availability
+ Specialist Availability
+ Diagnostic Availability
+ Medicine Availability
+ Capacity
+ Emergency Capability
+ Information Freshness
```

The implementation must document the actual weighting.

The score must be derived from database data, not hardcoded.

---

# 18. Offline Conflict Model

Conflict categories:

### Non-conflicting append
Example:

- new encounter
- new assessment
- new observation

### Version conflict
Example:

- same patient field edited on two devices

### Sensitive merge
Example:

- treatment or clinically important state changed concurrently

Sensitive conflicts should be surfaced for human resolution rather than silently overwritten.

---

# 19. Failure Handling

AyuSync must remain safe when:

- AI unavailable
- AI times out
- AI returns invalid output
- internet unavailable
- sync fails
- sync partially fails
- conflict occurs
- facility unavailable
- specialist unavailable
- diagnostics unavailable
- medicines unavailable
- appointment slot disappears
- referral is rejected
- notification fails
- socket disconnects
- external interoperability service is unavailable

Every failure needs:

- clear status
- safe fallback
- user-visible explanation
- retry/next action
- audit where appropriate

---

# 20. Mandatory Failure Test Suite

Create:

`backend/test_failures.js`

Required scenarios:

1. AI timeout
2. AI unavailable
3. AI invalid response
4. offline registration
5. sync conflict
6. duplicate sync
7. partial sync failure
8. facility unavailable
9. specialist unavailable
10. diagnostic unavailable
11. medicine unavailable
12. appointment double booking
13. referral rejection
14. invalid referral transition
15. stuck referral
16. overdue follow-up
17. missed appointment
18. notification failure
19. unauthorized patient access
20. realtime disconnect/reconnect

No test may simply mock the feature being tested and then claim the feature works.

---

# 21. Mandatory End-to-End Scenario

Run the actual complete workflow:

```text
Worker Login
↓
Patient Registration
↓
Assessment
↓
Vitals
↓
AI Triage
↓
Human Confirmation
↓
Intelligent Routing
↓
Appointment
↓
Queue
↓
Doctor Consultation
↓
Diagnostic Order
↓
Diagnostic Result
↓
Medicine Availability
↓
Referral
↓
Receiving Facility
↓
Referral Acceptance
↓
Patient Arrival
↓
Consultation
↓
Counter-Referral
↓
Follow-up
↓
Follow-up becomes overdue
↓
Care-gap detection
↓
Task generation
↓
Worker notification
↓
Follow-up completion
↓
Care Journey Closure
```

No manual database manipulation is permitted during the acceptance test.

---

# 22. SIH Demonstration Scenario

The demo should show a realistic rural case.

### Stage 1 — Frontline Worker

Worker is offline.

Registers patient.

Captures assessment and vitals.

System stores data locally.

### Stage 2 — Connectivity Returns

Sync begins.

Mutation is uploaded.

Backend validates idempotency.

Data becomes part of longitudinal record.

### Stage 3 — AI Decision Support

AI evaluates structured information.

Returns:

- urgency
- explanation
- confidence
- missing information

Worker/doctor confirms.

### Stage 4 — Routing

System evaluates facilities.

Shows ranked destinations and reasons.

### Stage 5 — Appointment & Queue

Appointment is created.

Patient enters queue.

Doctor sees live queue update.

### Stage 6 — Consultation

Doctor accesses longitudinal context.

Creates:

- consultation
- prescription
- diagnostic order

### Stage 7 — Referral

Referral is submitted.

Receiving facility accepts.

Patient arrives.

### Stage 8 — Counter-Referral

Receiving doctor documents outcome.

Follow-up is automatically generated.

### Stage 9 — Care Gap

Patient misses follow-up.

System detects overdue status.

Task is created.

Worker is notified.

### Stage 10 — Closure

Worker completes follow-up.

Care journey becomes complete.

This demonstrates the core innovation:

> **AyuSync does not stop when the consultation ends.**

---

# 23. Requirement Traceability Matrix

Create:

`docs/MASTER_PLAN_REQUIREMENT_MATRIX.md`

Every requirement must contain:

| Phase | Requirement | Backend | Frontend | AI | DB | Integration | Test | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|

Allowed status:

- COMPLETE
- PARTIAL
- BROKEN
- MOCKED
- UNVERIFIED
- MISSING

Only COMPLETE counts toward completion.

External credentials may produce UNVERIFIED only for the genuinely external boundary.

---

# 24. Completion Rules

AyuSync is NOT complete merely because:

- a UI exists
- an endpoint exists
- a database model exists
- a test is green
- documentation says 100%
- a mock returns expected output

A requirement is complete only when:

**Implemented + Integrated + Real Data + Tested + Failure Handling + Evidence**

are all present.

---

# 25. Code Quality Rules

Avoid:

- duplicated business logic
- hardcoded outcomes
- hidden mocks
- magic numbers without explanation
- unrestricted agent tools
- direct database access from AI agents
- unvalidated AI responses
- silent data overwrites
- unhandled promises
- unhandled exceptions
- insecure secrets
- unnecessary coupling

Prefer:

- modular services
- typed contracts
- schema validation
- transactions
- dependency boundaries
- adapters
- repository/service separation
- reusable UI components
- testable functions
- explicit state machines

---

# 26. Documentation Deliverables

Required:

- `README.md`
- `docs/MASTER_PLAN_REQUIREMENT_MATRIX.md`
- `docs/FINAL_PROJECT_AUDIT.md`
- `docs/FINAL_COMPLETION_REPORT.md`
- AI service README
- architecture documentation
- API documentation
- sync documentation
- agent safety documentation
- interoperability documentation
- deployment documentation

Documentation must reflect actual implementation.

---

# 27. Final Verification Checklist

## Backend

- [ ] 24/24 phases complete
- [ ] all APIs functional
- [ ] database complete
- [ ] state machines tested
- [ ] security tested
- [ ] jobs tested
- [ ] realtime tested

## Frontend

- [ ] 20/20 phases complete
- [ ] Web connected to backend
- [ ] Flutter connected to backend
- [ ] offline workflows work
- [ ] accessibility verified
- [ ] error states verified

## AI

- [ ] modular Python architecture
- [ ] triage
- [ ] routing
- [ ] explanation
- [ ] safety rules
- [ ] validation
- [ ] provider abstraction
- [ ] prediction
- [ ] agent

## Agentic AI

- [ ] OBSERVE
- [ ] PLAN
- [ ] EXECUTE
- [ ] VALIDATE
- [ ] AUDIT
- [ ] allowlisted tools
- [ ] human approval
- [ ] no direct DB access

## Offline

- [ ] Web local DB
- [ ] Flutter local DB
- [ ] mutation queue
- [ ] sync
- [ ] idempotency
- [ ] conflict handling

## Operations

- [ ] care gaps
- [ ] referrals
- [ ] counter-referrals
- [ ] follow-ups
- [ ] notifications
- [ ] facility readiness
- [ ] analytics
- [ ] prediction

## Interoperability

- [ ] adapter
- [ ] standardized mappings
- [ ] sandbox
- [ ] validation
- [ ] external boundary

## Testing

- [ ] unit
- [ ] integration
- [ ] E2E
- [ ] failure suite
- [ ] security
- [ ] realtime
- [ ] sync
- [ ] AI
- [ ] agent

---

# 28. Definition of 100% Completion

AyuSync may be declared:

# AYUSYNC MASTER PLAN — 100% VERIFIED COMPLETE

ONLY when:

1. All 24 backend phases are COMPLETE.
2. All 20 frontend phases are COMPLETE.
3. AI is genuinely integrated.
4. Agentic AI is genuinely implemented.
5. Offline workflows genuinely work.
6. Synchronization genuinely works.
7. Conflict resolution genuinely works.
8. Realtime genuinely works.
9. Referral lifecycle genuinely works.
10. Counter-referral genuinely works.
11. Follow-up genuinely works.
12. Care-gap automation genuinely works.
13. Facility readiness uses real data.
14. Intelligent routing uses real data.
15. Analytics use real data.
16. Predictive operations use actual prediction logic.
17. Voice/multilingual architecture is functional.
18. Interoperability adapter works in sandbox/local mode.
19. Security is tested.
20. Failure tests pass.
21. Complete E2E journey passes.
22. Requirement matrix has zero MISSING/PARTIAL/BROKEN/MOCKED items.
23. Only genuinely external credential-dependent integrations may remain UNVERIFIED.
24. Build and deployment checks pass.
25. Documentation matches the actual codebase.

---

# 29. Final Product Positioning

AyuSync should be positioned as:

> **An offline-first, AI-assisted, closed-loop care coordination and operational intelligence platform that strengthens existing public-health infrastructure by connecting assessment, triage, routing, consultation, diagnostics, medicines, referrals, counter-referrals and follow-up into one accountable care journey.**

The strongest SIH story is not:

> "We built an AI healthcare app."

It is:

> **"We built a system that can detect where a patient's care journey is breaking, explain why it is happening, identify the next best operational action, work even when connectivity fails, and keep following the journey until care is actually completed."**

---

# 30. Implementation Order

Execute in this order:

```text
1. Audit existing repository
2. Complete backend foundations
3. Complete clinical workflows
4. Complete referral/follow-up lifecycle
5. Complete offline + sync + conflict
6. Complete realtime
7. Build modular AI service
8. Build explainable triage
9. Build intelligent routing
10. Build care-gap engine
11. Build controlled agent
12. Complete analytics
13. Complete prediction
14. Complete interoperability
15. Complete Flutter
16. Complete Web UX
17. Voice + multilingual
18. Security hardening
19. Failure tests
20. Complete E2E
21. Requirement matrix
22. Fresh final audit
23. Fix every remaining gap
24. Re-test
25. Declare completion only after evidence
```

---

# 31. Non-Negotiable Engineering Rule

Never optimize for the appearance of completeness.

Optimize for:

**real functionality + safe healthcare workflows + explainability + resilience + measurable continuity + interoperability + demonstrable impact.**

The final system should not merely look impressive during an SIH presentation.

It should demonstrate a credible path toward deployment in real-world public-health environments.
