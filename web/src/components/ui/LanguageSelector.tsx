import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { SUPPORTED_LANGUAGES, LanguageDefinition } from "../../i18n/languages";
import { Languages, ChevronDown, Check, Search, Mic, Volume2 } from "lucide-react";

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, currentLanguageDef } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(
    (lang) =>
      lang.nativeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.englishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (langCode: string) => {
    setLanguage(langCode);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-800 shadow-xs transition-colors cursor-pointer"
        title="Select Interface Language (23 Indian Languages Supported)"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Languages size={13} className="text-[#1e6641] shrink-0" />
        <span className="font-bold text-[#1e6641]">{currentLanguageDef.nativeName}</span>
        <span className="hidden xl:inline text-gray-500 font-normal">({currentLanguageDef.englishName.split(" ")[0]})</span>
        <ChevronDown size={11} className="text-gray-400 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 rounded-2xl bg-white shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search language / भाषा खोजें..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-[#1e6641]"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-1.5">
              <span>23 Indian Languages</span>
              <span className="flex items-center gap-1.5">
                <span className="flex items-center gap-0.5"><Mic size={9} className="text-emerald-600" /> Voice In</span>
                <span className="flex items-center gap-0.5"><Volume2 size={9} className="text-indigo-600" /> TTS</span>
              </span>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1 divide-y divide-gray-50">
            {filteredLanguages.map((lang: LanguageDefinition) => {
              const isSelected = language === lang.code || (language === "hi" && lang.code === "hi-IN") || (language === "en" && lang.code === "en-IN");
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-xs transition-colors ${
                    isSelected
                      ? "bg-[#e4efe7] text-[#1e6641] font-bold"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">{lang.nativeName}</span>
                    <span className="text-[10px] text-gray-400">{lang.englishName}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {lang.speechInputSupported && (
                      <span title="Voice Input Supported" className="text-[10px] text-emerald-700 bg-emerald-100/60 px-1 py-0.2 rounded">
                        🎙
                      </span>
                    )}
                    {lang.speechOutputSupported ? (
                      <span title="Voice Output Supported" className="text-[10px] text-indigo-700 bg-indigo-100/60 px-1 py-0.2 rounded">
                        🔊
                      </span>
                    ) : (
                      <span title="Text Translation Fallback" className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.2 rounded">
                        Text
                      </span>
                    )}
                    {isSelected && <Check size={13} className="text-[#1e6641] ml-1 shrink-0" />}
                  </div>
                </button>
              );
            })}
            {filteredLanguages.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">No matching language found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default LanguageSelector;
