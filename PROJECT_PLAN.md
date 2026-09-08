# AyuSync - Multi-Stage Roadmap

## Phase 1: Hackathon MVP
- **Objective**: Build the core closed-loop orchestration system.
- **Key Features**:
  - Flutter app with SQLite offline sync and basic form inputs.
  - Node.js backend with Prisma ORM and Socket.io.
  - Mock ABDM deterministic routing (basic patient registry simulation).
  - React UI with real-time Doctor Dashboard.
  - Python FastAPI service for prompt-based explainable triage (using basic heuristics or lightweight LLM).

## Phase 2: Beta Rollout
- **Objective**: Harden the system and integrate real registries.
- **Key Features**:
  - Live ABDM registries integration (ABHA ID generation).
  - Socket.io production scaling (Redis adapter).
  - Advanced Auth (JWT, Role-Based Access Control).
  - Cloud deployment (AWS / GCP).

## Phase 3: Production & Advanced Features
- **Objective**: Scale for national impact.
- **Key Features**:
  - Bhashini voice-to-text integration for ASHA workers.
  - Predictive supply chain analytics (medicine stock alerts based on triage frequency).
  - Full end-to-end encryption for FHIR-compliant payloads.
