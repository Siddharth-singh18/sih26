/**
 * AYUSYNC CANONICAL 23 INDIAN LANGUAGE REGISTRY (BACKEND)
 * Standard: 8th Schedule of Indian Constitution + English (en-IN)
 * Data-driven capabilities matrix for Text, STT (Saaras), and TTS (Bulbul).
 */

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
    primaryScript: 'Latin'
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
    primaryScript: 'Devanagari'
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
    primaryScript: 'Bengali'
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
    primaryScript: 'Gujarati'
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
    primaryScript: 'Kannada'
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
    primaryScript: 'Malayalam'
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
    primaryScript: 'Devanagari'
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
    primaryScript: 'Odia'
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
    primaryScript: 'Gurmukhi'
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
    primaryScript: 'Tamil'
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
    primaryScript: 'Telugu'
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
    primaryScript: 'Bengali-Assamese'
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
    primaryScript: 'Devanagari'
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
    primaryScript: 'Devanagari'
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
    primaryScript: 'Devanagari'
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
    primaryScript: 'Perso-Arabic'
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
    primaryScript: 'Devanagari'
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
    primaryScript: 'Meitei Mayek'
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
    primaryScript: 'Devanagari'
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
    primaryScript: 'Devanagari'
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
    primaryScript: 'Ol Chiki'
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
    primaryScript: 'Perso-Arabic'
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
    primaryScript: 'Perso-Arabic'
  }
];

export const LANGUAGE_MAP = new Map<string, LanguageDefinition>(
  SUPPORTED_LANGUAGES.map(lang => [lang.code, lang])
);

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

