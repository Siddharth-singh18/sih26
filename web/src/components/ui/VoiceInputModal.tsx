import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, Check, X, AlertCircle } from 'lucide-react';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';
import { useLanguage } from '../../context/LanguageContext';

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void;
  title?: string;
  initialText?: string;
  targetFieldLabel?: string;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  initialText = '',
  targetFieldLabel,
}) => {
  const { t, language, currentLanguageDef } = useLanguage();
  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    speak,
    cancelSpeaking,
  } = useVoiceAssistant();

  const [editableText, setEditableText] = useState(initialText);

  // Sync transcript updates into editable text
  useEffect(() => {
    if (transcript) {
      setEditableText(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (isOpen) {
      setEditableText(initialText);
      resetTranscript();
    } else {
      stopListening();
      cancelSpeaking();
    }
  }, [isOpen, initialText, resetTranscript, stopListening, cancelSpeaking]);

  if (!isOpen) return null;

  const handleToggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleConfirm = () => {
    stopListening();
    cancelSpeaking();
    onConfirm(editableText.trim());
    onClose();
  };

  const handleSpeakDraft = () => {
    if (editableText.trim()) {
      speak(editableText.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-[#e4efe7] text-[#1e6641]'}`}>
              <Mic size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                {title || t('voice.title', 'Voice Assistant')}
              </h3>
              <p className="text-xs text-gray-500">
                {language === 'hi' ? 'हिंदी व अंग्रेजी दोनों समर्थित' : 'Hindi & English speech supported'}
                {currentLanguageDef.nativeName} ({currentLanguageDef.englishName}) · Voice Safety Gate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Support warning */}
        {!isSupported && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t('voice.unsupported', 'Speech API not supported natively in this browser.')}</p>
              <p className="mt-0.5">You can still type directly into the verification box below.</p>
            </div>
          </div>
        )}

        {/* Dynamic State Alert */}
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Listening Indicator */}
        {isSupported && (
          <div className="flex flex-col items-center justify-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <button
              onClick={handleToggleListen}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md ${
                isListening
                  ? 'bg-red-500 text-white animate-bounce'
                  : 'bg-[#1e6641] text-white hover:bg-[#165032]'
              }`}
            >
              {isListening ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
            <p className="text-xs font-medium text-gray-700 mt-3">
              {isListening
                ? t('voice.listening', 'Listening... Speak now')
                : `Tap microphone to speak in ${currentLanguageDef.nativeName}`}
            </p>
            {interimTranscript && (
              <p className="text-xs text-gray-400 italic mt-1 px-4 text-center">
                "{interimTranscript}"
              </p>
            )}
          </div>
        )}

        {/* Text Verification Area (Safety Gate) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">
              {t('voice.confirm_prompt', 'Verify transcript before submitting:')}
              {targetFieldLabel ? `Field: ${targetFieldLabel} (Mandatory Verification)` : t('voice.confirm_prompt', 'Verify transcript before submitting:')}
            </label>
            {editableText && (
              <button
                type="button"
                onClick={handleSpeakDraft}
                className="text-[11px] text-[#1e6641] hover:underline flex items-center gap-1 font-medium"
              >
                <Volume2 size={12} />
                {language === 'hi' ? 'सुनें' : 'Read aloud'}
              </button>
            )}
          </div>
          <textarea
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            placeholder={
              language === 'hi'
                ? 'बोले गए शब्द यहाँ दिखेंगे। आवश्यकतानुसार संपादित करें...'
                : 'Spoken text will appear here. Edit as needed...'
            }
            rows={4}
            className="w-full text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e6641] focus:border-transparent outline-none resize-none font-sans"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('voice.cancel_btn', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!editableText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1e6641] text-white rounded-lg hover:bg-[#165032] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            <Check size={14} />
            {t('voice.confirm_btn', 'Confirm & Use')}
          </button>
        </div>
      </div>
    </div>
  );
};
export default VoiceInputModal;

