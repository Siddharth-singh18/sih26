/**
 * AYUSYNC MEDICAL TERMINOLOGY SAFETY LAYER (FRONTEND)
 * Preserves exact numerical vitals and parameters verbatim from PostgreSQL.
 */

export interface MedicalConditionTemplate {
  canonicalKey: string;
  canonicalMeaning: string;
  safeEnglish: string;
  simpleEnglish: string;
  localizedTemplates: Record<string, { standard: string; simple: string }>;
}

export const CANONICAL_MEDICAL_TERMS: Record<string, MedicalConditionTemplate> = {
  'SPO2_LOW': {
    canonicalKey: 'SPO2_LOW',
    canonicalMeaning: 'Oxygen Saturation below critical threshold (< 90%)',
    safeEnglish: 'Your body oxygen level is lower than normal. Urgent clinical stabilization required.',
    simpleEnglish: 'Your oxygen level is low. You need to see a doctor quickly to help your breathing.',
    localizedTemplates: {
      'hi-IN': {
        standard: 'आपके शरीर में ऑक्सीजन का स्तर सामान्य से कम है। तत्काल चिकित्सकीय देखभाल आवश्यक है।',
        simple: 'आपके शरीर में ऑक्सीजन कम है। सांस लेने में मदद के लिए डॉक्टर को तुरंत दिखाएं।'
      },
      'hi': {
        standard: 'आपके शरीर में ऑक्सीजन का स्तर सामान्य से कम है। तत्काल चिकित्सकीय देखभाल आवश्यक है।',
        simple: 'आपके शरीर में ऑक्सीजन कम है। सांस लेने में मदद के लिए डॉक्टर को तुरंत दिखाएं।'
      },
      'mr-IN': {
        standard: 'तुमच्या शरीरातील ऑक्सिजनची पातळी सामान्य प्रमाणापेक्षा कमी आहे. तातडीने उपचारांची गरज आहे.',
        simple: 'तुमच्या शरीरात ऑक्सिजन कमी आहे. लवकर डॉक्टरांचा सल्ला घ्या.'
      },
      'ta-IN': {
        standard: 'உங்கள் உடலில் ஆக்சிஜன் அளவு குறைவாக உள்ளது. அவசர மருத்துவ சிகிச்சை தேவைப்படுகிறது.',
        simple: 'உங்கள் உடலில் ஆக்சிஜன் குறைவு. உடனே மருத்துவரை அணுகவும்.'
      }
    }
  },
  'BP_HIGH': {
    canonicalKey: 'BP_HIGH',
    canonicalMeaning: 'Hypertensive Crisis / Stage 2 (Systolic > 180 mmHg)',
    safeEnglish: 'Your blood pressure is critically elevated. Avoid physical exertion and seek immediate physician review.',
    simpleEnglish: 'Your blood pressure is very high. Sit down, rest, and do not do heavy work.',
    localizedTemplates: {
      'hi-IN': {
        standard: 'आपका रक्तचाप (बीपी) अत्यधिक बढ़ा हुआ है। भारी काम न करें और डॉक्टर से तुरंत परामर्श लें।',
        simple: 'आपका बीपी बहुत ज्यादा है। आराम से बैठें और कोई भारी काम न करें।'
      },
      'hi': {
        standard: 'आपका रक्तचाप (बीपी) अत्यधिक बढ़ा हुआ है। भारी काम न करें और डॉक्टर से तुरंत परामर्श लें।',
        simple: 'आपका बीपी बहुत ज्यादा है। आराम से बैठें और कोई भारी काम न करें।'
      },
      'mr-IN': {
        standard: 'तुमचा रक्तदाब अत्यंत वाढलेला आहे. विश्रांती घ्या आणि तातडीने डॉक्टरांना भेटा.',
        simple: 'तुमचा बीपी खूप जास्त आहे. शांत बसा, वजनदार काम करू नका.'
      },
      'ta-IN': {
        standard: 'உங்கள் இரத்த அழுத்தம் மிகவும் அதிகமாக உள்ளது. உடனடியாக மருத்துவரை அணுகவும்.',
        simple: 'உங்கள் ரத்த அழுத்தம் அதிகம். ஓய்வெடுங்கள், கடின உழைப்பைத் தவிர்க்கவும்.'
      }
    }
  },
  'FEVER': {
    canonicalKey: 'FEVER',
    canonicalMeaning: 'Body temperature elevated above 100.4°F (38.0°C)',
    safeEnglish: 'High body temperature detected. Hydration and clinical monitoring advised.',
    simpleEnglish: 'You have a fever. Drink clean water, take rest, and check temperature again.',
    localizedTemplates: {
      'hi-IN': {
        standard: 'शरीर का तापमान सामान्य से अधिक है (बुखार)। खूब पानी पिएं और निगरानी रखें।',
        simple: 'आपको तेज बुखार है। खूब पानी पिएं और आराम करें।'
      },
      'mr-IN': {
        standard: 'शरीराचे तापमान वाढले आहे (ताप). भरपूर पाणी प्या आणि विश्रांती घ्या.',
        simple: 'तुम्हाला ताप आला आहे. स्वच्छ पाणी प्या आणि विश्रांती घ्या.'
      },
      'ta-IN': {
        standard: 'உடல் வெப்பநிலை அதிகமாக உள்ளது (காய்ச்சல்). போதிய நீர் அருந்தவும்.',
        simple: 'உங்களுக்கு காய்ச்சல் உள்ளது. நிறைய தண்ணீர் குடித்து ஓய்வெடுக்கவும்.'
      }
    }
  },
  'RESPIRATORY_DISTRESS': {
    canonicalKey: 'RESPIRATORY_DISTRESS',
    canonicalMeaning: 'Acute respiratory rate acceleration or dyspnea',
    safeEnglish: 'Acute respiratory distress observed. Immediate oxygenation protocol required.',
    simpleEnglish: 'You are having trouble breathing. Get to the nearest health clinic right away.',
    localizedTemplates: {
      'hi-IN': {
        standard: 'सांस लेने में गंभीर कठिनाई हो रही है। निकटतम स्वास्थ्य केंद्र पर तत्काल जाएं।',
        simple: 'सांस फूल रही है। बिना देर किए तुरंत अस्पताल जाएं।'
      },
      'mr-IN': {
        standard: 'श्वास घेण्यास तीव्र अडचण येत आहे. जवळच्या प्राथमिक केंद्रात जा.',
        simple: 'श्वास लागत आहे. ताबडतोब दवाखान्यात जा.'
      },
      'ta-IN': {
        standard: 'மூச்சு விடுவதில் தீவிர சிரமம் உள்ளது. அருகிலுள்ள மருத்துவமனைக்குச் செல்லவும்.',
        simple: 'மூச்சு திணறல் உள்ளது. உடனே மருத்துவமனைக்குச் செல்லவும்.'
      }
    }
  },
  'URGENT_REFERRAL': {
    canonicalKey: 'URGENT_REFERRAL',
    canonicalMeaning: 'Specialist care needed at referral center',
    safeEnglish: 'Specialist care required at a tertiary hospital. Inter-facility referral created.',
    simpleEnglish: 'You need care at a bigger hospital with specialist doctors. We are booking your transfer.',
    localizedTemplates: {
      'hi-IN': {
        standard: 'आपको बड़े अस्पताल में विशेषज्ञ चिकित्सक की जांच की आवश्यकता है। रेफरल तैयार किया गया है।',
        simple: 'आपको बड़े अस्पताल जाना होगा। हम आपके लिए डॉक्टर का प्रबंध कर रहे हैं।'
      },
      'mr-IN': {
        standard: 'तुम्हाला मोठ्या रुग्णालयात तज्ज्ञ डॉक्टरांच्या उपचारांची गरज आहे. रेफरल तयार केले आहे.',
        simple: 'तुम्हाला मोठ्या दवाखान्यात जावे लागेल. आम्ही डॉक्टरांची भेट निश्चित करत आहोत.'
      },
      'ta-IN': {
        standard: 'உயர் மருத்துவமனையில் சிறப்பு மருத்துவர் சிகிச்சை தேவைப்படுகிறது. பரிந்துரை பதிவு செய்யப்பட்டது.',
        simple: 'பெரிய மருத்துவமனைக்கு செல்ல வேண்டும். மருத்துவர் சந்திப்பு பதிவு செய்யப்பட்டுள்ளது.'
      }
    }
  },
  'EMERGENCY': {
    canonicalKey: 'EMERGENCY',
    canonicalMeaning: 'Code Red priority',
    safeEnglish: 'Emergency code activated. Immediate ambulance dispatch and bed reservation initiated.',
    simpleEnglish: 'This is an emergency. Call 108 ambulance now and do not delay.',
    localizedTemplates: {
      'hi-IN': {
        standard: 'आपातकालीन चेतावनी सक्रिय। तुरंत 108 एम्बुलेंस को कॉल करें।',
        simple: 'यह आपातकाल है। तुरंत 108 एम्बुलेंस बुलाएं।'
      },
      'mr-IN': {
        standard: 'आपत्कालीन इशारा सक्रिय. त्वरित १०८ रुग्णवाहिका बोलवा.',
        simple: 'ही गंभीर परिस्थिती आहे. ताबडतोब १०८ ला कॉल करा.'
      },
      'ta-IN': {
        standard: 'அவசர எச்சரிக்கை செயல்படுத்தப்பட்டது. 108 ஆம்புலன்ஸை அழைக்கவும்.',
        simple: 'இது அவசர நிலை. உடனே 108 ஆம்புலன்ஸை அழைக்கவும்.'
      }
    }
  },
  'FOLLOWUP_OVERDUE': {
    canonicalKey: 'FOLLOWUP_OVERDUE',
    canonicalMeaning: 'Chronic or antenatal visit overdue',
    safeEnglish: 'Clinical follow-up visit is past due. Frontline outreach task assigned.',
    simpleEnglish: 'Your doctor visit date has passed. Your ASHA worker will visit your home to check your health.',
    localizedTemplates: {
      'hi-IN': {
        standard: 'आपकी नियमित जांच का समय बीत चुका है। आशा कार्यकर्ता को आपके घर आने का निर्देश दिया गया है।',
        simple: 'जांच का समय निकल गया है। आपकी आशा दीदी घर आकर दवा और बीपी देखेंगी।'
      },
      'mr-IN': {
        standard: 'तपासणीची मुदत संपली आहे. आशा कार्यकर्त्या तुमच्या घरी भेट देतील.',
        simple: 'तपासणीचा दिवस उलटून गेला आहे. आशा ताई घरी येऊन तपासणी करतील.'
      },
      'ta-IN': {
        standard: 'மருத்துவ பரிசோதனைக்கான காலக்கெடு முடிந்துவிட்டது. ஆஷா பணியாளர் வீட்டிற்கு வருவார்.',
        simple: 'பரிசோதனை தேதி முடிந்தது. ஆஷா பணியாளர் உங்கள் வீட்டிற்கு வந்து பார்ப்பார்.'
      }
    }
  }
};

export function formatMedicalExplanation(
  termKey: string,
  numericValue: string | number,
  unit: string,
  languageCode: string,
  simpleMode: boolean = false
): {
  canonicalDisplay: string;
  localizedText: string;
  isSafe: boolean;
} {
  const term = CANONICAL_MEDICAL_TERMS[termKey];
  const canonicalDisplay = `${termKey}: ${numericValue} ${unit}`.trim();

  if (!term) {
    return {
      canonicalDisplay,
      localizedText: canonicalDisplay,
      isSafe: true
    };
  }

  const langKey = languageCode.trim();
  const shortKey = langKey.split('-')[0];
  const localization = term.localizedTemplates[langKey] || term.localizedTemplates[shortKey];

  let explanation = '';
  if (localization) {
    explanation = simpleMode ? localization.simple : localization.standard;
  } else {
    explanation = simpleMode ? term.simpleEnglish : term.safeEnglish;
  }

  return {
    canonicalDisplay,
    localizedText: `${canonicalDisplay} — ${explanation}`,
    isSafe: true
  };
}

