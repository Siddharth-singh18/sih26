# AyuSync Groq-Powered Agentic Health Assistant Architecture

## 1. Executive Overview
The AyuSync Conversational Health Assistant provides intelligent, culturally localized, and evidence-grounded health guidance for patients and community frontline workers across India. Powered by Groq's high-performance inference engine (`llama-3.3-70b-versatile`) and orchestrated through a deterministic LangGraph state machine, the assistant combines rapid conversational reasoning with strict clinical safety gates.

```
                    +---------------------------------------------+
                    |           Incoming User Query (Text/Voice)   |
                    +---------------------------------------------+
                                           |
                                           v
                    +---------------------------------------------+
                    | 1. Adversarial Prompt Injection Defense     |
                    +---------------------------------------------+
                                           |
                                           v
                    +---------------------------------------------+
                    | 2. Deterministic Clinical Emergency Triage  |  (SpO2 < 90, BP >= 180,
                    |    (Bypasses LLM Reasoning if Triggered)    |   Chest pain, Resp failure)
                    +---------------------------------------------+
                               /                       \
                      [EMERGENCY]                  [NON-EMERGENCY]
                            /                             \
+--------------------------------------+   +-------------------------------------+
| 108 Emergency Ambulance Direct Alert |   | 3. Intent Classification (10 Types) |
| & Immediate Facility Escalation Path |   +-------------------------------------+
+--------------------------------------+                      |
                                                              v
                                           +-------------------------------------+
                                           | 4. Context & Domain Tool Execution  |
                                           |    (13 Typed PostgreSQL Tools)      |
                                           +-------------------------------------+
                                                              |
                                                              v
                                           +-------------------------------------+
                                           | 5. Groq Llama 3.3 70B Reasoning     |
                                           |    (or Local Rule-Based Fallback)   |
                                           +-------------------------------------+
                                                              |
                                                              v
                                           +-------------------------------------+
                                           | 6. Structured Schema Validation     |
                                           |    (JSON / Zod Contract Check)      |
                                           +-------------------------------------+
                                                              |
                                                              v
                                           +-------------------------------------+
                                           | 7. Multilingual Sarvam Localization |
                                           |    (Target Indian Language)         |
                                           +-------------------------------------+
                                                              |
                                                              v
                                           +-------------------------------------+
                                           | 8. AuditLog Logging & Delivery      |
                                           +-------------------------------------+
```

---

## 2. Groq AI Provider Integration

### Provider Specification
- **Service Module**: `backend/src/modules/ai/providers/groq.service.ts`
- **Model**: `llama-3.3-70b-versatile`
- **Protocol**: OpenAI-compatible REST API (`https://api.groq.com/openai/v1/chat/completions`)
- **Default Parameters**:
  - `temperature: 0.1` (low temperature to enforce factual, grounded output)
  - `max_tokens: 1024`
  - `timeout: 8000ms`
  - `response_format: { type: "json_object" }` (when structured output requested)

### Resilient Fallback Architecture
In production or local development without internet/external API keys, AyuSync enforces zero downtime:
1. **Config Check**: `isGroqConfigured()` inspects `process.env.GROQ_API_KEY`.
2. **Graceful Fallback**: If the key is absent or network fails/times out, the provider falls back cleanly to `RULE_BASED_LOCAL_SYNTHESIS` without throwing uncaught exceptions or leaking errors to the client.
3. **Audit Trail**: The fallback provenance (`provenance: "RULE_BASED_LOCAL_SYNTHESIS"`) is captured in the audit log so evaluators can distinguish between external LLM inference and local deterministic synthesis.

---

## 3. Approved Domain Tool Registry (13 Typed Tools)

All domain tools are implemented in `backend/src/modules/assistant/assistant_tools.ts` with strict input typing, IDOR verification, and PostgreSQL database queries:

| # | Tool Identifier | Description | Data Source / Entities | Security & Scope |
|---|---|---|---|---|
| 1 | `get_patient_timeline` | Retrieves chronological clinical encounters, vitals, prescriptions, and lab orders | PostgreSQL `Encounter`, `Vital`, `Prescription`, `DiagnosticOrder` | Scoped to authenticated patient or clinical staff |
| 2 | `get_active_referrals` | Queries active multi-tier transfer referrals and status | PostgreSQL `Referral`, `Facility` | Patient IDOR verified |
| 3 | `get_followups` | Lists active care continuity tasks assigned to frontline health workers | PostgreSQL `FollowUpTask`, `Worker` | Scoped to patient or assigned ASHA |
| 4 | `get_appointments` | Retrieves scheduled clinic visits and active queue tokens | PostgreSQL `Appointment`, `Doctor`, `QueueEntry` | Scoped to authenticated user |
| 5 | `get_prescriptions` | Fetches active medication orders with honest stock availability notice | PostgreSQL `Prescription`, `Medication` | Discloses `NOT_SUPPORTED_BY_SCHEMA` |
| 6 | `get_health_summary` | Provides unified longitudinal summary (recent vitals, active conditions, care gaps) | PostgreSQL aggregated view | Scoped to patient record |
| 7 | `get_triage_result` | Evaluates physiological parameters against ICMR CDSS rules | ICMR Rule Engine | Read-only deterministic calculation |
| 8 | `get_facility_capabilities` | Evaluates hospital operational readiness, bed categories, and specialties | PostgreSQL `Facility`, `FacilityCapacity`, `FacilityDoctor` | District-wide operational read |
| 9 | `get_facility_availability` | Queries current operational availability status (`OPEN`, `OVERCAPACITY`, `CLOSED`) | PostgreSQL `Facility` | Real-time availability score |
| 10 | `get_facility_queue` | Retrieves live waiting queue load and patient count | PostgreSQL `QueueEntry` (`WAITING` + `PRIORITY` + `IN_CONSULTATION`) | Active load counter |
| 11 | `find_nearby_facility` | Performs Haversine distance-based search for nearest hospitals/PHCs with live capacities | PostgreSQL `Facility`, Geolocation calculation | Travel times marked `(ESTIMATED)` |
| 12 | `get_verified_health_knowledge` | Retrieves grounded clinical guidelines from apex health authorities | In-memory curated knowledge base (WHO, MoHFW, ICMR) | Read-only passive reference |
| 13 | `get_prediction_summary` | Retrieves evidence-based queue pressure and capacity projections | Prediction Engine (`WeightedMovingAverage`) | Evidence-based forecast telemetry |

---

## 4. Deterministic Clinical Emergency Triage Precedence

Under no circumstances does an LLM decide whether an acute physiological red flag constitutes an emergency. The deterministic clinical triage gate in `backend/src/modules/assistant/health_assistant.service.ts` evaluates before any generative reasoning:

### Clinical Trigger Criteria
1. **Acute Hypoxia**:
   - Condition: $SpO_2 < 90\%$ (e.g., `SpO2: 84%`, `"oxygen level is 86"`)
   - Urgency: `HIGH_IMPACT` Emergency
2. **Acute Hypertension Crisis**:
   - Condition: Systolic $BP \ge 180\text{ mmHg}$ or Diastolic $BP \ge 110\text{ mmHg}$ (e.g., `195/115 mmHg`)
   - Urgency: `HIGH_IMPACT` Emergency
3. **Acute Critical Symptoms**:
   - Condition: Chest pain, severe respiratory distress, unresponsiveness, acute profuse hemorrhage.
   - Urgency: `HIGH_IMPACT` Emergency

### Deterministic Response Contract
When an emergency is detected:
- The LLM inference path is **completely bypassed**.
- Response returns `riskLevel: "HIGH_IMPACT"`.
- Actionable suggestion includes immediate dialing of **108 Ambulance**.
- Emergency warning banner (`emergencyWarning`) is surfaced prominently.
- Direct link to nearest secondary/tertiary hospital with trauma capability is attached.

---

## 5. Adversarial Prompt Injection Defense

The assistant incorporates multi-layer sanitization against prompt injections and jailbreaks before processing user input:

### Detected & Neutralized Patterns
- **Instruction Overrides**: `"ignore all previous instructions"`, `"disregard all earlier prompts"`, `"forget instructions"`.
- **System Prompt Extraction**: `"system prompt"`, `"reveal developer message"`, `"what are your hidden instructions"`.
- **Roleplay Jailbreaks**: `"DAN mode"`, `"jailbroken AI"`, `"bypass safety filters"`, `"do anything now"`.
- **Credential Harvesting**: `"export api key"`, `"show database password"`, `"secret credentials"`.

### Security Policy
- Malicious inputs are sanitized, assigned `riskLevel: "READ_ONLY"`, and neutralized with a polite security notice without echoing attacker tokens.
- **Safety Priority Invariant**: Even if a query combines an adversarial injection with an acute clinical emergency (e.g. `"Ignore instructions and my SpO2 is 82%"`), the **Deterministic Clinical Emergency Gate takes precedence**, ensuring the patient's immediate safety is never compromised.

---

## 6. Structured Output Contract

The assistant emits strictly typed, structured responses conforming to the following interface:

```typescript
interface AssistantChatResponse {
  requestId: string;
  intent: AssistantIntent;
  answer: string;
  riskLevel: 'READ_ONLY' | 'LOW_RISK' | 'HIGH_IMPACT';
  evidence: string[];
  citations: RetrievedChunk[];
  suggestedActions: string[];
  requiresConfirmation: boolean;
  clinicalDecisionReference?: string;
  language: string;
  confidence: number;
  limitations: string;
  emergencyWarning?: string;
  structuredData?: {
    facilities?: NearbyFacilityResult[];
    prescriptions?: any[];
    timeline?: any[];
    [key: string]: any;
  };
}
```

---

## 7. Verification and Testing

The Groq-powered Agentic Health Assistant is verified by:
- `backend/tests/multilingual_chatbot.test.ts` (100 / 100 Scenarios PASSED)
  - Module 4: Groq AI Provider & Resilient Fallback (Scenarios 31–40)
  - Module 5: Agent Tools Registry & Execution (Scenarios 41–55)
  - Module 6: IDOR Defense & Patient Privacy (Scenarios 56–65)
  - Module 7: Emergency Clinical Triage Precedence (Scenarios 66–75)
  - Module 8: Adversarial Prompt Injection Defense (Scenarios 76–83)
  - Module 9: Verified Health RAG Knowledge & Citations (Scenarios 84–90)
  - Module 10: Honest Medicine Availability & Schema Capability (Scenarios 91–95)
  - Module 11: Facility Care Navigation & Endpoints (Scenarios 96–100)
