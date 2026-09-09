/**
 * AYUSYNC CENTRALIZED MULTILINGUAL & HEALTH LITERACY LAYER
 * Supports English ('en') and Hindi ('hi').
 * Designed so additional Indian languages (Marathi, Kannada, etc.) can be added seamlessly.
 *
 * CRITICAL RULE: Clinical figures, vital signs, units, and dosages (e.g. 120/80 mmHg, 94%, 5mg)
 * remain medically precise and unchanged.
 */

export type SupportedLanguage = 'en' | 'hi';

export interface TranslationDictionary {
  [key: string]: {
    en: string;
    hi: string;
  };
}

export const I18N_DICTIONARY: TranslationDictionary = {
  // Brand & Shell
  'app.name': {
    en: 'SwasthyaSetu',
    hi: 'स्वास्थ्यसेतु'
  },
  'app.subtitle': {
    en: 'AyuSync · Baramati CHC',
    hi: 'आयुसिंक · बारामती सामुदायिक स्वास्थ्य केंद्र'
  },
  'nav.home': {
    en: 'Home',
    hi: 'होम'
  },
  'nav.tasks': {
    en: 'Home & Tasks',
    hi: 'कार्य व मुख्य पृष्ठ'
  },
  'nav.queue': {
    en: 'Consultation Queue',
    hi: 'परामर्श कतार'
  },
  'nav.continuity': {
    en: 'Care Continuity',
    hi: 'निरंतर देखभाल'
  },
  'nav.patients': {
    en: 'Patient Records',
    hi: 'मरीज रिकॉर्ड'
  },
  'nav.community': {
    en: 'Community Members',
    hi: 'ग्रामीण सदस्य'
  },
  'nav.clinic_status': {
    en: 'Clinic Status',
    hi: 'अस्पताल स्थिति'
  },
  'nav.operations': {
    en: 'Operations',
    hi: 'प्रचालन'
  },
  'nav.predictive': {
    en: 'Predictive Ops',
    hi: 'पूर्वानुमान'
  },

  // Actions & Buttons
  'action.save': {
    en: 'Save',
    hi: 'सहेजें'
  },
  'action.submit': {
    en: 'Submit',
    hi: 'जमा करें'
  },
  'action.cancel': {
    en: 'Cancel',
    hi: 'रद्द करें'
  },
  'action.confirm': {
    en: 'Confirm',
    hi: 'पुष्टि करें'
  },
  'action.review': {
    en: 'Review & Verify',
    hi: 'जांचें व सत्यापित करें'
  },
  'action.switch_role': {
    en: 'Switch Role',
    hi: 'भूमिका बदलें'
  },
  'action.voice_input': {
    en: 'Voice Input',
    hi: 'ध्वनि इनपुट'
  },
  'action.simple_mode': {
    en: 'Simple Explanation Mode',
    hi: 'सरल व्याख्या मोड'
  },

  // Clinical Triage Categories
  'triage.emergency': {
    en: 'EMERGENCY',
    hi: 'आपातकालीन'
  },
  'triage.urgent': {
    en: 'URGENT',
    hi: 'अति आवश्यक'
  },
  'triage.priority': {
    en: 'PRIORITY',
    hi: 'प्राथमिक'
  },
  'triage.routine': {
    en: 'ROUTINE',
    hi: 'सामान्य'
  },

  // Teleconsultation
  'teleconsult.title': {
    en: 'Assisted Teleconsultation',
    hi: 'सहायता प्राप्त ई-परामर्श'
  },
  'teleconsult.requested': {
    en: 'Consultation Requested',
    hi: 'परामर्श अनुरोधित'
  },
  'teleconsult.queued': {
    en: 'In Queue for Specialist',
    hi: 'विशेषज्ञ कतार में'
  },
  'teleconsult.in_progress': {
    en: 'Consultation In Progress',
    hi: 'परामर्श जारी है'
  },
  'teleconsult.completed': {
    en: 'Consultation Completed',
    hi: 'परामर्श संपन्न'
  },

  // Voice Assistant
  'voice.title': {
    en: 'Voice Assistant',
    hi: 'ध्वनि सहायक'
  },
  'voice.listening': {
    en: 'Listening... Speak in Hindi or English',
    hi: 'सुन रहे हैं... कृपया हिंदी या अंग्रेजी में बोलें'
  },
  'voice.confirm_prompt': {
    en: 'Please verify the captured text before submitting:',
    hi: 'जमा करने से पहले कृपया बोले गए शब्दों की जांच करें:'
  },
  'voice.confirm_btn': {
    en: 'Confirm & Use',
    hi: 'पुष्टि करें और उपयोग करें'
  },
  'voice.cancel_btn': {
    en: 'Cancel',
    hi: 'रद्द करें'
  },
  'voice.unsupported': {
    en: 'Speech recognition is not supported in this browser. Please use keyboard text input.',
    hi: 'इस ब्राउज़र में ध्वनि पहचान समर्थित नहीं है। कृपया कीबोर्ड का उपयोग करें।'
  }
};

/**
 * Controlled Patient-Friendly Health Literacy Terminology Templates
 */
export const HEALTH_LITERACY_EXPLANATIONS: Record<string, { en: string; hi: string }> = {
  'SPO2_LOW': {
    en: 'Your body oxygen level is lower than normal. It is important to see a doctor quickly to help your breathing.',
    hi: 'आपके शरीर में ऑक्सीजन की मात्रा सामान्य से कम है। सांस लेने में मदद के लिए डॉक्टर को तुरंत दिखाना आवश्यक है।'
  },
  'BP_HIGH': {
    en: 'Your blood pressure is very high. Avoid heavy exertion and take the prescribed blood pressure medication regularly.',
    hi: 'आपका रक्तचाप (बीपी) बहुत अधिक है। भारी काम न करें और डॉक्टर द्वारा दी गई बीपी की दवा समय पर लें।'
  },
  'URGENT_REFERRAL': {
    en: 'You need specialized medical care that is available at a larger hospital. We are connecting you directly with the specialist.',
    hi: 'आपको बड़े अस्पताल में विशेषज्ञ डॉक्टर की जांच की जरूरत है। हम आपको सीधे अस्पताल से जोड़ रहे हैं।'
  },
  'FOLLOW_UP_DUE': {
    en: 'Your follow-up visit is due. Your village ASHA worker will check your blood pressure and medicines at home.',
    hi: 'आपकी जांच का समय हो गया है। आपकी आशा कार्यकर्ता आपके घर आकर दवा और स्वास्थ्य की जांच करेंगी।'
  },
  'DIABETES_CARE': {
    en: 'Keep your blood sugar steady by taking medicines after food and avoiding sugary sweets.',
    hi: 'मीठे से परहेज करें और भोजन के बाद समय पर अपनी शुगर की दवा लें।'
  },
  'ICU_FULL': {
    en: 'All intensive care beds are currently occupied. Patients are being routed to neighboring hospitals with available beds.',
    hi: 'गंभीर आईसीयू बेड अभी भरे हुए हैं। मरीजों को पास के अन्य सक्षम अस्पतालों में भेजा जा रहा है।'
  }
};

