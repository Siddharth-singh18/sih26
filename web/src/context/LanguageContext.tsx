import React, { createContext, useContext, useState, useEffect } from "react";
import { SUPPORTED_LANGUAGES, LanguageDefinition, getLanguageDefinition } from "../i18n/languages";
import { translateWithFallback } from "../i18n/dictionaries";
import { formatMedicalExplanation } from "../i18n/medical_terms";

export type SupportedLanguage = string;

export interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  simpleMode: boolean;
  setSimpleMode: (enabled: boolean) => void;
  toggleSimpleMode: () => void;
  t: (key: string, fallback?: string) => string;
  t: (
    key: string,
    paramsOrFallback?: string | Record<string, string | number>,
    fallbackOverride?: string
  ) => string;
  explain: (termKey: string) => string | null;
  explainMedical: (
    termKey: string,
    numericValue: string | number,
    unit: string
  ) => { canonicalDisplay: string; localizedText: string; isSafe: boolean };
  fallbackActive: boolean;
  fallbackLanguage: string;
  availableLanguages: LanguageDefinition[];
  currentLanguageDef: LanguageDefinition;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(() => {
    const saved = localStorage.getItem("ayusync_lang");
    return saved || "en-IN";
  });

  const [simpleMode, setSimpleModeState] = useState<boolean>(() => {
    return localStorage.getItem("ayusync_simple_mode") === "true";
  });

  const [fallbackActive, setFallbackActive] = useState<boolean>(false);

  const currentLanguageDef = getLanguageDefinition(language);

  const setLanguage = (lang: string) => {
    const valid = getLanguageDefinition(lang);
    setLanguageState(valid.code);
    localStorage.setItem("ayusync_lang", valid.code);
  };

  const setSimpleMode = (enabled: boolean) => {
    setSimpleModeState(enabled);
    localStorage.setItem("ayusync_simple_mode", enabled ? "true" : "false");
  };

  const toggleSimpleMode = () => {
    setSimpleMode(!simpleMode);
  };

  const t = (key: string, fallback?: string): string => {
    const result = translateWithFallback(key, language, fallback);
  const t = (
    key: string,
    paramsOrFallback?: string | Record<string, string | number>,
    fallbackOverride?: string
  ): string => {
    const result = translateWithFallback(key, language, paramsOrFallback, fallbackOverride);
    if (result.isFallback && !fallbackActive && language !== "en-IN" && language !== "en") {
      setFallbackActive(true);
    }
    return result.text;
  };

  const explain = (termKey: string): string | null => {
    const explanation = formatMedicalExplanation(termKey, "", "", language, simpleMode);
    return explanation.localizedText;
  };

  const explainMedical = (
    termKey: string,
    numericValue: string | number,
    unit: string
  ) => {
    return formatMedicalExplanation(termKey, numericValue, unit, language, simpleMode);
  };

  useEffect(() => {
    document.documentElement.lang = currentLanguageDef.code;
    document.documentElement.dir = currentLanguageDef.direction;
    setFallbackActive(false);
  }, [language, currentLanguageDef]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        simpleMode,
        setSimpleMode,
        toggleSimpleMode,
        t,
        explain,
        explainMedical,
        fallbackActive,
        fallbackLanguage: "en-IN",
        availableLanguages: SUPPORTED_LANGUAGES,
        currentLanguageDef
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
