import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'hi' | 'mr'; // English, Hindi, Marathi

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.patients': 'Patients',
    'nav.queue': 'Live Queue',
    'nav.predictive': 'Analytics',
    'action.save': 'Save',
    'action.review': 'Review',
    'status.urgent': 'URGENT'
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.patients': 'मरीज़',
    'nav.queue': 'कतार',
    'nav.predictive': 'एनालिटिक्स',
    'action.save': 'सहेजें',
    'action.review': 'समीक्षा करें',
    'status.urgent': 'तत्काल'
  },
  mr: {
    'nav.dashboard': 'डॅशबोर्ड',
    'nav.patients': 'रुग्ण',
    'nav.queue': 'रांग',
    'nav.predictive': 'विश्लेषण',
    'action.save': 'जतन करा',
    'action.review': 'पुनरावलोकन',
    'status.urgent': 'तातडीचे'
  }
};

interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LocalizationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error("useLocalization must be used within LocalizationProvider");
  return context;
};
