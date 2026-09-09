# AyuSync Sarvam Voice Architecture: STT, TTS & Non-Autonomous Safety Review

## 1. Overview
AyuSync integrates Sarvam AI's speech technologies to provide voice-first healthcare access across diverse Indian linguistic communities:
- **Sarvam Saaras**: High-accuracy Speech-to-Text (STT) optimized for Indian accents, regional dialects, and code-mixing (e.g., Hinglish, Tanglish).
- **Sarvam Bulbul**: Natural Text-to-Speech (TTS) synthesizer producing clear regional speech for rural patients.

## 2. Mandatory Voice Confirmation Safety Gate
Under no circumstances does voice input autonomously mutate clinical records or trigger actions.

```
                  [Patient or Worker Speaks]
                             ↓
              [Sarvam Saaras STT Processing]
                             ↓
            [Editable Review Modal Surfaces]
              (Mandatory Verification Step)
                             ↓
             [Clinician / Patient Edits & Reviews]
                             ↓
               [Click "Confirm & Use" Button]
                             ↓
          [Form Input Populated / Standard Workflow]
```

## 3. Capability Matrix & Zero-Mock Transparency
For languages where native TTS/STT is not yet supported by Sarvam models, AyuSync adheres to its **Zero-Mock Policy**:
- Truthfully declares capability flags (`speechInputSupported: false`, `speechOutputSupported: false`).
- Never fabricates fake voice synthesis or mocks external responses.
- Degrades gracefully to client-side browser speech synthesis (`SpeechSynthesisUtterance` / Web Speech API) or clean visual text with an explicit disclaimer.
- When `SARVAM_API_KEY` is not present, backend services transparently report `BLOCKED_EXTERNAL` and guide the user to text interaction.
