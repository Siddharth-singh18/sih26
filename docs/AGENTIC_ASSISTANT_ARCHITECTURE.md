# AyuSync Conversational Healthcare Assistant: LangGraph Orchestration & Safety

## 1. Overview
The AyuSync Conversational Assistant is an agentic care navigation and health guidance assistant designed for rural Indian healthcare environments.

## 2. LangGraph State Machine Workflow
```
[START]
   ↓
[detect_language]
   ↓
[safety_check] ──(Critical Red Flag?)──→ [Trigger Emergency Referral Pipeline]
   ↓ (Non-Emergency)                                  ↓
[classify_intent]                               [Call 108 Guidance]
   ↓
[retrieve_patient_context] (Strict RBAC Authorization Defense)
   ↓
[retrieve_facility_context] (Real Haversine Distance & Active Queue Load)
   ↓
[retrieve_verified_health_knowledge] (Curated WHO/MoHFW Knowledge Base)
   ↓
[call_domain_tools]
   ↓
[reason & validate output schema]
   ↓
[translate to target Indian language]
   ↓
[assemble citations & provenance]
   ↓
[write immutable record to AuditLog]
   ↓
[END]
```

## 3. Ten Core Intents Handled
1. `HEALTH_INFORMATION`: Verified guidance on conditions (dengue, tuberculosis, hypertension, etc.).
2. `SYMPTOM_INFORMATION`: Plain-language explanation of physiological signs.
3. `MEDICATION_GENERAL_INFORMATION`: Transparent disclosure of formulary items (`NOT_SUPPORTED_BY_SCHEMA` for live stock).
4. `FACILITY_NAVIGATION`: Real nearest facility routing based on bed capacity, distance, and queue load.
5. `APPOINTMENT_HELP`: Upcoming consultation queue tokens and clinic status.
6. `REFERRAL_STATUS`: Multi-tier transfer status tracking across PHC, CHC, and District Hospitals.
7. `FOLLOWUP_STATUS`: ASHA frontline visit schedule and chronic disease monitoring.
8. `PATIENT_RECORD_QUERY`: Patient chronological clinical journey review.
9. `EMERGENCY_HELP`: Immediate red-flag triage, ambulance dispatch, and tertiary stabilization.
10. `LANGUAGE_HELP`: Guidance on switching interface languages across 23 supported options.

## 4. Structured Output Contract
Free-form, unvalidated generative output is strictly prohibited. The assistant adheres to:
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
  structuredData?: Record<string, any>;
}
```

