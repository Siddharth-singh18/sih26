# AYUSYNC SIH 2026 — FINAL AUTHENTIC DEMO WALKTHROUGH
**Duration:** 6–8 Minutes  
**Demonstration Scope:** 23 Languages $\to$ Sarvam Voice $\to$ Groq Health Assistant $\to$ Live Nearby Care $\to$ Frontline Care $\to$ Doctor Queue $\to$ Emergency Escalation $\to$ Predictive Ops $\to$ Agentic AI with Human Approval  
**Zero-Mock Guarantee:** Live PostgreSQL Authoritative Data Only | 575 / 575 Verified Automated Tests

---

## Demo Overview & Roles
The demo follows the clinical care journey of **Ramesh Kulkarni** (rural patient in Khandala village, Baramati block, Pune district) and demonstrates cross-role continuity across:
- 🧑 **Ramesh Kulkarni** (Rural Patient / Care Recipient)
- 👩‍⚕️ **Sunita Patil** (Frontline Health Worker / ASHA, Khandala Sub-Centre)
- 👨‍⚕️ **Dr. Rajesh Deshmukh** (Chief Medical Officer, Baramati Sub-District Hospital & CHC)

---

## Step-by-Step 7-Act Walkthrough Script

### ACT 1: India-Wide 23 Languages & Sarvam Voice Accessibility (1 Minute)
1. **Open Application & Language Selection:**
   - Open web application at `http://localhost:5173`.
   - Click the top language selector dropdown in the header:
     - Notice all **23 Indian languages** (all 22 8th Schedule languages + Indian English) with native scripts (मराठी, தமிழ், తెలుగు, বাংলা, हिंदी, etc.).
     - Select **मराठी (Marathi)** or **தமிழ் (Tamil)**.
     - Observe navigation items, role badges, and action buttons instantly localize.
     - Highlight the smooth transparent fallback to English for any untranslated terms without intrusive warning banners.
2. **Health Literacy (सरल भाषा / Simple Mode):**
   - Toggle **सरल भाषा (Simple Mode)** in the header.
   - Clinical terms (`SPO2_LOW`, `BP_HIGH`) render plain-language, non-intimidating descriptions while vital signs and numerical values remain exact from PostgreSQL.
3. **Sarvam-Powered Voice Input with Safety Review Gate:**
   - Click **ध्वनि सहायक (Voice Assistant)** or the microphone icon.
   - Notice the Sarvam Saaras indicator and target form field selector.
   - Speak or review the captured draft transcription.
   - **Crucial Safety Rule Demonstration:** The speech transcription appears in an editable modal with an explicit *"Confirm & Use"* button. Voice input is **strictly non-autonomous** and will never mutate PostgreSQL records without explicit human review and confirmation.

---

### ACT 2: Groq-Powered Health Assistant & Live Care Navigation (1.5 Minutes)
1. **Patient Health Assistant Drawer:**
   - Click **आरोग्य सहायक (Health Assistant)** button in the header.
   - The conversational assistant drawer opens with quick-prompt chips.
   - Ask: *"What should I do for high fever and joint pain in dengue season?"*
   - Observe the response generated via **Groq Llama 3.3 70B** and **Verified Health RAG**:
     - Answers grounded strictly in apex guidelines (ICMR / WHO / MoHFW).
     - Notice the **Source Citations** badge at the bottom of the message.
     - Click **View Citations**: Inspect authentic apex source metadata (Authority: *ICMR / WHO Guidelines for Dengue Management*, Verified URL, Document ID).
   - Test **Clinical Safety Precedence**:
     - Ask: *"I have severe chest pain and my oxygen level is 84"*
     - Notice the assistant immediately triggers emergency triage override: advises calling 108 Ambulance immediately, renders direct call button, highlights red flags, and bypasses generic conversational delays.
   - Test **Read Aloud**: Click the speaker button to invoke Bulbul TTS speech synthesis.
2. **Find Nearby Care Modal:**
   - Click **जवळचे रुग्णालय (Find Nearby Care)** on the cohesive patient dashboard card.
   - The modal calculates real-time **Haversine distance** from the user's location.
   - View live facility cards: Baramati Sub-District Hospital (CHC), Khandala PHC, Junnar Rural Hospital.
   - Filter by **Emergency / ICU Available** to isolate high-acuity facilities.
   - Point out the clear distinction between real PostgreSQL live bed counts and transit times marked with `(ESTIMATED)`.

---

### ACT 3: Frontline Care, Household Intake & Assisted Teleconsultation (1 Minute)
1. **Login as Frontline Worker:**
   - Click the top right **Role Switcher** pill and select **👩‍⚕️ Health Worker (ASHA)**.
   - System dynamically identifies Sunita Patil at Khandala Sub-Centre.
2. **Longitudinal Household Member Discovery:**
   - Search for **Ramesh Kulkarni** by village ("Khandala") or phone (`9111222333`).
   - View longitudinal timeline with authentic encounters and vitals history.
3. **Assisted Teleconsultation Request:**
   - Click **Request Teleconsultation**.
   - Record frontline vitals: BP 160/100, SpO2 89%, Pulse 104.
   - System registers session with status `REQUESTED` and enqueues the patient into the teleconsultation queue.

---

### ACT 4: Deterministic Emergency Escalation Pipeline (1 Minute)
1. **Critical Condition Trigger:**
   - In case of acute decompensation (SpO2 < 85% or Hypertensive Crisis BP > 180/110), frontline worker initiates **Emergency Escalation**.
   - Deterministic clinical triage classifies acuity as `EMERGENCY` using ICMR/WHO protocols.
2. **Capability-Aware Routing & Priority Referral:**
   - Capability routing engine selects **Baramati Sub-District Hospital & CHC** based on live ICU bed readiness.
   - Priority referral is generated in PostgreSQL with urgency `URGENT` and status `SUBMITTED`.
3. **Realtime Broadcast:**
   - A realtime WebSocket event (`EMERGENCY_TRANSFER`) is emitted to the target facility room (`facility:fac-baramati-chc`).
   - Destination physicians receive immediate notification in their clinical inbox.

---

### ACT 5: Doctor Consultation, Live Queue & Closed-Loop Care (1 Minute)
1. **Switch to Doctor Role:**
   - Click the **Role Switcher** pill to switch to **👨‍⚕️ Doctor (MO)** (Dr. Rajesh Deshmukh).
2. **Live Consultation Queue:**
   - Navigate to **Consultation Queue** (`/queue`).
   - Ramesh Kulkarni appears with priority token.
   - Click **Start Consultation**: status transitions to `IN_CONSULTATION` synchronously across all connected sockets.
3. **Conduct Consultation & Counter-Referral:**
   - Clinician reviews transmitted vitals, enters diagnosis (*Hypertensive Crisis*), prescribes *Amlodipine 5mg*, and orders diagnostic tests.
   - Completes consultation: Queue entry completes, encounter written to PostgreSQL, and closed-loop follow-up task is dispatched to ASHA Sunita Patil.

---

### ACT 6: Controlled Agentic AI with Human Approval Gate (1 Minute)
1. **Agentic AI Orchestration:**
   - Open **Operations & Intelligence** (`/operations`).
   - Trigger the **Controlled Agent Graph** across the 4 core workflows (`CARE_COORDINATION`, `REFERRAL_CLOSURE`, `FACILITY_OPERATIONS`, `FOLLOWUP_GAP`).
2. **Safety Classification & Human Gate:**
   - Read-only and low-risk informational tasks execute safely.
   - Consequential mutations (referral updates, bed quota reallocation) are classified as `HIGH_IMPACT`.
   - **Crucial Demo Moment:** The agent **halts at the Human Approval Gate** with status `PENDING_HUMAN_APPROVAL`.
   - Doctor reviews evidence provenance, ICMR guideline citations, and bilingual explanations.
   - Click **Approve & Execute**: Only upon explicit clinician authorization does the database transaction execute.

---

### ACT 7: Operational Analytics, Predictive Forecasting & Zero-Mock Truth (1 Minute)
1. **Descriptive Analytics:**
   - Display real PostgreSQL aggregations: 567 total district beds, live ICU occupancy, general ward utilization rate.
   - Show active queue pressure across primary and secondary facilities.
   - Show the **Referral Bottleneck Analysis**: Junnar Rural Hospital $\to$ Baramati CHC corridor with average turnaround time calculated from authentic `ReferralEvent` timestamps.
2. **Evidence-Based Predictive Forecasting:**
   - Show 2-hour and 4-hour forward **Queue Pressure Prediction** powered by Weighted Moving Average.
   - Show **Capacity Pressure Projections**: Evaluates inbound emergency transfers against current bed availability to predict ICU saturation before it occurs.
   - Point out **Temporal Backtesting Card**: Verified on historical data with 0 data leakage.
3. **Zero-Mock & Architectural Disclosures:**
   - Open Medicine Availability: Discloses `NOT_SUPPORTED_BY_SCHEMA` for multi-facility stock ledgers while serving authentic catalog data.
   - Show ABDM/ABHA integration status: Honestly reports `BLOCKED_EXTERNAL` without fabricating fake tokens.
   - Show PostgreSQL `AuditLog` table containing immutable audit records for every user interaction during the demo.

---

## Quick Reference Credential Cheatsheet for Presenter
| Actor | Role | Phone | Password | Facility |
|---|---|---|---|---|
| Dr. Rajesh Deshmukh | Doctor / CMO | `9876543210` | `password123` | Baramati Sub-District Hospital & CHC |
| Dr. Anand Joshi | Pediatrician | `9876543212` | `password123` | Junnar Rural Hospital |
| Sunita Patil | ASHA / Health Worker | `9876543211` | `password123` | Khandala Sub-Centre / PHC |
| Ramesh Kulkarni | Rural Patient | `9111222333` | `password123` | Village Khandala |
