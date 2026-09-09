# AyuSync Multilingual Architecture: India-Wide 23-Language Access

## 1. Architectural Overview
AyuSync supports all **22 official languages** recognized under the Eighth Schedule of the Constitution of India, plus **Indian English (`en-IN`)**, enabling healthcare workers, rural patients, and medical officers to interact in their native mother tongue.

## 2. Canonical Language Registry
The language registry is centrally defined and data-driven in:
- Frontend: [`web/src/i18n/languages.ts`](file:///home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean/web/src/i18n/languages.ts)
- Backend: [`backend/src/modules/i18n/languages.ts`](file:///home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean/backend/src/modules/i18n/languages.ts)

### Supported Language Matrix
| Code | Language | Native Name | Script | Direction | Text | STT (Saaras) | TTS (Bulbul) | Fallback |
|---|---|---|---|:---:|:---:|:---:|:---:|:---:|
| `en-IN` | English (India) | English | Latin | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `hi-IN` | Hindi | हिन्दी | Devanagari | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `bn-IN` | Bengali | বাংলা | Bengali | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `gu-IN` | Gujarati | ગુજરાતી | Gujarati | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `kn-IN` | Kannada | ಕನ್ನಡ | Kannada | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `ml-IN` | Malayalam | മലയാളം | Malayalam | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `mr-IN` | Marathi | मराठी | Devanagari | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `od-IN` | Odia | ଓଡ଼ିଆ | Odia | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `pa-IN` | Punjabi | ਪੰਜਾਬੀ | Gurmukhi | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `ta-IN` | Tamil | தமிழ் | Tamil | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `te-IN` | Telugu | తెలుగు | Telugu | LTR | ✓ | ✓ | ✓ | `en-IN` |
| `as-IN` | Assamese | অসমীয়া | Assamese | LTR | ✓ | Browser | Browser | `en-IN` |
| `brx-IN`| Bodo | बड़ो | Devanagari | LTR | ✓ | Browser | Browser | `en-IN` |
| `doi-IN`| Dogri | डोगरी | Devanagari | LTR | ✓ | Browser | Browser | `en-IN` |
| `kok-IN`| Konkani | कोंकणी | Devanagari | LTR | ✓ | Browser | Browser | `en-IN` |
| `ks-IN` | Kashmiri | کٲشُر | Perso-Arabic| RTL | ✓ | Browser | Browser | `en-IN` |
| `mai-IN`| Maithili | मैथिली | Devanagari | LTR | ✓ | Browser | Browser | `en-IN` |
| `mni-IN`| Manipuri | মৈতৈলোন্ | Meitei | LTR | ✓ | Browser | Browser | `en-IN` |
| `ne-IN` | Nepali | नेपाली | Devanagari | LTR | ✓ | Browser | Browser | `en-IN` |
| `sa-IN` | Sanskrit | संस्कृतम् | Devanagari | LTR | ✓ | Browser | Browser | `en-IN` |
| `sat-IN`| Santali | ᱥᱟᱱᱛᱟᱲᱤ | Ol Chiki | LTR | ✓ | Browser | Browser | `en-IN` |
| `sd-IN` | Sindhi | سنڌي | Perso-Arabic| RTL | ✓ | Browser | Browser | `en-IN` |
| `ur-IN` | Urdu | اردو | Perso-Arabic| RTL | ✓ | Browser | Browser | `en-IN` |

---

## 3. App-Wide Localization Hierarchy & Clean Fallbacks
1. **Multi-Key UI Dictionaries**: Centralized in [`web/src/i18n/dictionaries.ts`](file:///home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean/web/src/i18n/dictionaries.ts) with 50+ keys covering Navigation, Patient Identity, Consultation Queue, Vitals Snapshot, Care Actions, Prescriptions, Referrals, and Emergency Care.
2. **Transparent English Fallback**: When an untranslated phrase is encountered, the canonical English term renders smoothly. No intrusive or permanent yellow warning banners distract patients.
3. **Canonical Clinical Numerical Preservation**:
   - Vital measurements ($136/86\text{ mmHg}$, $74\text{ bpm}$, $186\text{ mg/dL}$, $98\%$) and medication dosages ($500\text{ mg}$, $1\text{ tablet}$) are locked in code and NEVER modified, translated, or mangled by generative LLMs.
   - Clinical risk codes (`SPO2_LOW`, `BP_HIGH`, `FASTING_BG_HIGH`, `MATERNAL_RISK`) are processed through deterministic plain-language templates.
4. **Interactive Language Selector**:
   - Embedded in top navbar with native script previews (e.g. `मराठी`, `தமிழ்`, `తెలుగు`, `বাংলা`).
   - Integrated quick search filter.
   - Visual capability badges (`🎙 Voice In`, `🔊 TTS`, `Text`).
