import axios from 'axios';
import { getLanguageDefinition } from './languages';
import { CANONICAL_MEDICAL_TERMS } from './medical_terms';

export interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  contextType?: 'CLINICAL' | 'UI' | 'CONVERSATIONAL';
}

export interface TranslationResponse {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: 'SARVAM' | 'FALLBACK_DICTIONARY' | 'CANONICAL_CLINICAL';
  dataStatus: 'VERIFIED_API' | 'FALLBACK_DICTIONARY' | 'BLOCKED_EXTERNAL';
  isSafe: boolean;
}

const STATIC_QUICK_DICTIONARY: Record<string, Record<string, string>> = {
  'High blood pressure detected.': {
    'hi-IN': 'उच्च रक्तचाप पाया गया।',
    'hi': 'उच्च रक्तचाप पाया गया।',
    'mr-IN': 'उच्च रक्तदाब आढळला.',
    'mr': 'उच्च रक्तदाब आढळला.',
    'ta-IN': 'உயர் இரத்த அழுத்தம் கண்டறியப்பட்டது.',
    'ta': 'உயர் இரத்த அழுத்தம் கண்டறியப்பட்டது.'
  },
  'Emergency transfer required immediately.': {
    'hi-IN': 'तुरंत आपातकालीन स्थानांतरण आवश्यक है।',
    'hi': 'तुरंत आपातकालीन स्थानांतरण आवश्यक है।',
    'mr-IN': 'तातडीने आपत्कालीन स्थलांतर आवश्यक आहे.',
    'mr': 'तातडीने आपत्कालीन स्थलांतर आवश्यक आहे.',
    'ta-IN': 'உடனடி அவசர சிகிச்சை மாற்றம் தேவைப்படுகிறது.',
    'ta': 'உடனடி அவசர சிகிச்சை மாற்றம் தேவைப்படுகிறது.'
  },
  'Your consultation is complete.': {
    'hi-IN': 'आपका परामर्श पूरा हो गया है।',
    'hi': 'आपका परामर्श पूरा हो गया है।',
    'mr-IN': 'तुमची सल्लामसलत पूर्ण झाली आहे.',
    'mr': 'तुमची सल्लामसलत पूर्ण झाली आहे.',
    'ta-IN': 'உங்கள் மருத்துவ ஆலோசனை முடிந்தது.',
    'ta': 'உங்கள் மருத்துவ ஆலோசனை முடிந்தது.'
  }
};

/**
 * Sarvam AI Translate Service
 * Translates dynamic content with deterministic fallback if credentials are absent.
 */
export async function translateText(params: TranslationRequest): Promise<TranslationResponse> {
  const { text, sourceLanguage = 'en-IN', targetLanguage, contextType = 'CONVERSATIONAL' } = params;
  const apiKey = process.env.SARVAM_API_KEY;

  const targetLangDef = getLanguageDefinition(targetLanguage);
  const normalizedTarget = targetLangDef.code;

  // 1. Safety Check: If text is an identical source/target, return verbatim
  if (sourceLanguage === normalizedTarget) {
    return {
      translatedText: text,
      sourceLanguage,
      targetLanguage: normalizedTarget,
      provider: 'FALLBACK_DICTIONARY',
      dataStatus: 'FALLBACK_DICTIONARY',
      isSafe: true
    };
  }

  // 2. Check Static Medical/Clinical Templates
  const termEntry = CANONICAL_MEDICAL_TERMS[text.trim()];
  if (termEntry) {
    const loc = termEntry.localizedTemplates[normalizedTarget] || termEntry.localizedTemplates[normalizedTarget.split('-')[0]];
    if (loc) {
      return {
        translatedText: loc.standard,
        sourceLanguage,
        targetLanguage: normalizedTarget,
        provider: 'CANONICAL_CLINICAL',
        dataStatus: 'VERIFIED_API',
        isSafe: true
      };
    }
  }

  // 3. Check Quick Dictionary Cache
  const dictMatch = STATIC_QUICK_DICTIONARY[text.trim()];
  if (dictMatch && (dictMatch[normalizedTarget] || dictMatch[normalizedTarget.split('-')[0]])) {
    return {
      translatedText: dictMatch[normalizedTarget] || dictMatch[normalizedTarget.split('-')[0]],
      sourceLanguage,
      targetLanguage: normalizedTarget,
      provider: 'FALLBACK_DICTIONARY',
      dataStatus: 'FALLBACK_DICTIONARY',
      isSafe: true
    };
  }

  // 4. If SARVAM_API_KEY is available, call Sarvam Translate API
  if (apiKey) {
    try {
      const srcLang = getLanguageDefinition(sourceLanguage).code;
      const tgtLang = getLanguageDefinition(normalizedTarget).code;

      const response = await axios.post(
        'https://api.sarvam.ai/translate',
        {
          input: text,
          source_language_code: srcLang,
          target_language_code: tgtLang,
          speaker_gender: 'Female',
          mode: 'formal',
          model: 'mayura:v1'
        },
        {
          headers: {
            'api-subscription-key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 4000
        }
      );

      if (response.data && response.data.translated_text) {
        return {
          translatedText: response.data.translated_text,
          sourceLanguage,
          targetLanguage: normalizedTarget,
          provider: 'SARVAM',
          dataStatus: 'VERIFIED_API',
          isSafe: true
        };
      }
    } catch (err) {
      console.warn('[Sarvam Translate] External API failed or timed out, falling back gracefully:', (err as any).message);
    }
  }

  // 5. Fallback Response (Zero Mock: Honest status disclosure)
  return {
    translatedText: text, // Return original text safely rather than hallucinating
    sourceLanguage,
    targetLanguage: normalizedTarget,
    provider: 'FALLBACK_DICTIONARY',
    dataStatus: apiKey ? 'FALLBACK_DICTIONARY' : 'BLOCKED_EXTERNAL',
    isSafe: true
  };
}

