/**
 * AYUSYNC CANONICAL 23 INDIAN LANGUAGE REGISTRY
 * Standard: 8th Schedule of Indian Constitution + English (en-IN)
 * Data-driven capabilities matrix for Text, STT (Saaras), and TTS (Bulbul).
 */

export type UICapability = 'FULL_UI' | 'PARTIAL_UI' | 'TEXT_ONLY' | 'FALLBACK';

export interface LanguageDefinition {
  code: string;
  locale: string;
  englishName: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  textSupported: boolean;
  translationSupported: boolean;
  speechInputSupported: boolean;
  speechOutputSupported: boolean;
  fallbackCode: string;
  primaryScript: string;
  uiCapability: UICapability;
}

export const SUPPORTED_LANGUAGES: LanguageDefinition[] = [
  {
    code: 'en-IN',
    locale: 'en-IN',
    englishName: 'English (India)',
    nativeName: 'English',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Latin',
    uiCapability: 'FULL_UI'
  },
  {
    code: 'hi-IN',
    locale: 'hi-IN',
    englishName: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Devanagari',
    uiCapability: 'FULL_UI'
  },
  {
    code: 'bn-IN',
    locale: 'bn-IN',
    englishName: 'Bengali',
    nativeName: 'বাংলা',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Bengali',
    uiCapability: 'FULL_UI'
  },
  {
    code: 'gu-IN',
    locale: 'gu-IN',
    englishName: 'Gujarati',
    nativeName: 'ગુજરાતી',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Gujarati',
    uiCapability: 'PARTIAL_UI'
  },
  {
    code: 'kn-IN',
    locale: 'kn-IN',
    englishName: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Kannada',
    uiCapability: 'PARTIAL_UI'
  },
  {
    code: 'ml-IN',
    locale: 'ml-IN',
    englishName: 'Malayalam',
    nativeName: 'മലയാളം',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Malayalam',
    uiCapability: 'PARTIAL_UI'
  },
  {
    code: 'mr-IN',
    locale: 'mr-IN',
    englishName: 'Marathi',
    nativeName: 'मराठी',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Devanagari',
    uiCapability: 'FULL_UI'
  },
  {
    code: 'od-IN',
    locale: 'od-IN',
    englishName: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Odia',
    uiCapability: 'PARTIAL_UI'
  },
  {
    code: 'pa-IN',
    locale: 'pa-IN',
    englishName: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Gurmukhi',
    uiCapability: 'PARTIAL_UI'
  },
  {
    code: 'ta-IN',
    locale: 'ta-IN',
    englishName: 'Tamil',
    nativeName: 'தமிழ்',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Tamil',
    uiCapability: 'FULL_UI'
  },
  {
    code: 'te-IN',
    locale: 'te-IN',
    englishName: 'Telugu',
    nativeName: 'తెలుగు',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: true,
    speechOutputSupported: true,
    fallbackCode: 'en-IN',
    primaryScript: 'Telugu',
    uiCapability: 'FULL_UI'
  },
  {
    code: 'as-IN',
    locale: 'as-IN',
    englishName: 'Assamese',
    nativeName: 'অসমীয়া',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Bengali-Assamese',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'brx-IN',
    locale: 'brx-IN',
    englishName: 'Bodo',
    nativeName: 'बड़ो',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Devanagari',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'doi-IN',
    locale: 'doi-IN',
    englishName: 'Dogri',
    nativeName: 'डोगरी',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Devanagari',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'kok-IN',
    locale: 'kok-IN',
    englishName: 'Konkani',
    nativeName: 'कोंकणी',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Devanagari',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'ks-IN',
    locale: 'ks-IN',
    englishName: 'Kashmiri',
    nativeName: 'कॉशुर / کٲشُر',
    direction: 'rtl',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Perso-Arabic',
    uiCapability: 'FALLBACK'
  },
  {
    code: 'mai-IN',
    locale: 'mai-IN',
    englishName: 'Maithili',
    nativeName: 'मैथिली',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Devanagari',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'mni-IN',
    locale: 'mni-IN',
    englishName: 'Manipuri',
    nativeName: 'মৈতৈলোন্',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Meitei Mayek',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'ne-IN',
    locale: 'ne-IN',
    englishName: 'Nepali',
    nativeName: 'नेपाली',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Devanagari',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'sa-IN',
    locale: 'sa-IN',
    englishName: 'Sanskrit',
    nativeName: 'संस्कृतम्',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Devanagari',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'sat-IN',
    locale: 'sat-IN',
    englishName: 'Santali',
    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',
    direction: 'ltr',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Ol Chiki',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'sd-IN',
    locale: 'sd-IN',
    englishName: 'Sindhi',
    nativeName: 'سنڌي / सिन्धी',
    direction: 'rtl',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Perso-Arabic',
    uiCapability: 'TEXT_ONLY'
  },
  {
    code: 'ur-IN',
    locale: 'ur-IN',
    englishName: 'Urdu',
    nativeName: 'اردو',
    direction: 'rtl',
    textSupported: true,
    translationSupported: true,
    speechInputSupported: false,
    speechOutputSupported: false,
    fallbackCode: 'en-IN',
    primaryScript: 'Perso-Arabic',
    uiCapability: 'TEXT_ONLY'
  }
];

export const LANGUAGE_MAP = new Map<string, LanguageDefinition>(
  SUPPORTED_LANGUAGES.map(lang => [lang.code, lang])
);

// Allow lookup by short code (e.g., 'en', 'hi', 'ta')
SUPPORTED_LANGUAGES.forEach(lang => {
  const short = lang.code.split('-')[0];
  if (!LANGUAGE_MAP.has(short)) {
    LANGUAGE_MAP.set(short, lang);
  }
});

export function getLanguageDefinition(code: string): LanguageDefinition {
  const normalized = (code || 'en-IN').trim();
  return LANGUAGE_MAP.get(normalized) || LANGUAGE_MAP.get(normalized.split('-')[0]) || SUPPORTED_LANGUAGES[0];
}

export function isLanguageSupported(code: string): boolean {
  if (!code) return false;
  const normalized = code.trim();
  return LANGUAGE_MAP.has(normalized) || LANGUAGE_MAP.has(normalized.split('-')[0]);
}

export function getVoiceCapabilities(code: string): { stt: boolean; tts: boolean } {
  const def = getLanguageDefinition(code);
  return {
    stt: def.speechInputSupported,
    tts: def.speechOutputSupported
  };
}

export function getLanguagesByCapability(capability: UICapability): LanguageDefinition[] {
  return SUPPORTED_LANGUAGES.filter(lang => lang.uiCapability === capability);
}

