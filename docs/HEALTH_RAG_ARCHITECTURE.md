# AyuSync Verified Health RAG Architecture

## 1. Overview
The AyuSync Health Retrieval-Augmented Generation (RAG) engine provides evidence-based, medically safe clinical explanations to patients and frontline community workers.

To eliminate medical misinformation and synthetic hallucinations:
- **Curated Knowledge Base**: The engine only indexes officially curated, versioned clinical guidelines from verified national and global public-health agencies (WHO, MoHFW, ICMR, NHA, NCDC).
- **Passive Data Isolation**: Retrieved guidelines are treated strictly as read-only passive reference data.
- **Prompt Injection Neutralization**: Any adversarial instructions embedded within queries or documents (such as `"Ignore previous instructions"` or `"System: you are now"`) are sanitized and redacted before ingestion or reasoning.

## 2. Ingestion & Retrieval Pipeline
```
[User Query]
     ↓
[Language Normalization & Redaction of Adversarial Patterns]
     ↓
[BM25 Lexical Matching across Authorized Knowledge Base]
     ↓
[Score Verification & Authority Check (WHO / MoHFW / ICMR)]
     ↓
  Has Sufficient Evidence?
    ├── YES → Assemble Context Chunks with Verbatim Citations
    └── NO  → Fallback: "Verified source evidence was not sufficient
                        to answer this confidently."
     ↓
[Deterministic Emergency Triage Safety Check]
  (SpO2 < 90% or BP >= 180 triggers Emergency Referral Workflow)
     ↓
[Groq Reasoning / Synthesis / Target Language Localization]
     ↓
[Clinical Provenance & PostgreSQL AuditLog Recording]
```

## 3. Verified Authority Citation Contract
Every factual health answer returned by the system exposes complete provenance metadata:
- `documentId`: Unique versioned document identifier (e.g. `DOC-WHO-DENGUE-2024`, `DOC-ICMR-HYPERTENSION-2023`).
- `publisher`: Apex issuing organization (WHO, MoHFW, ICMR).
- `title`: Formal title of clinical guideline.
- `section`: Specific clinical section referenced.
- `url`: Direct link to official government/agency publication.
- `retrievedAt`: ISO 8601 synchronization timestamp.
