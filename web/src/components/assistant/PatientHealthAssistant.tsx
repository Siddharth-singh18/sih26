import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { VoiceInputModal } from '../ui/VoiceInputModal';
import {
  MessageSquare,
  Mic,
  Volume2,
  AlertTriangle,
  Send,
  BookOpen,
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Building2,
  Navigation,
  Clock
} from 'lucide-react';
import api from '../../lib/api';

interface Citation {
  documentId: string;
  source: string;
  title: string;
  section: string;
  url: string;
  publisher: string;
  snippet: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  emergencyWarning?: string;
  suggestedActions?: string[];
  structuredData?: Record<string, any>;
  timestamp: string;
}

interface PatientHealthAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
}

let assistantMsgSeq = 0;
function createAssistantMsgId(prefix: string): string {
  assistantMsgSeq += 1;
  return `${prefix}_${assistantMsgSeq}`;
}

export const PatientHealthAssistant: React.FC<PatientHealthAssistantProps> = ({
  isOpen,
  onClose,
  patientId
}) => {
  const { language, simpleMode, toggleSimpleMode, t, currentLanguageDef } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCitations, setActiveCitations] = useState<Citation[] | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: t(
        'assistant.welcome',
        'Namaste! I am your AyuSync Health Assistant. You can ask me health questions, find the nearest hospital with available beds, or check your upcoming care schedule.'
      ),
      timestamp: '10:00 AM'
    }
  ]);

  React.useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [
          {
            id: 'welcome',
            sender: 'assistant',
            text: t(
              'assistant.welcome',
              'Namaste! I am your AyuSync Health Assistant. You can ask me health questions, find the nearest hospital with available beds, or check your upcoming care schedule.'
            ),
            timestamp: '10:00 AM'
          }
        ];
      }
      return prev;
    });
  }, [language, t]);

  if (!isOpen) return null;

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || loading) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: ChatMessage = {
      id: createAssistantMsgId('user_msg'),
      sender: 'user',
      text: textToSend,
      timestamp: currentTime
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await api.post('/assistant/chat', {
        query: textToSend,
        patientId,
        languageCode: language,
        simpleMode
      });

      const assistantMessage: ChatMessage = {
        id: response.data.requestId || createAssistantMsgId('resp_msg'),
        sender: 'assistant',
        text: response.data.answer,
        citations: response.data.citations,
        emergencyWarning: response.data.emergencyWarning,
        suggestedActions: response.data.suggestedActions,
        structuredData: response.data.structuredData,
        timestamp: currentTime
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: createAssistantMsgId('err_msg'),
        sender: 'assistant',
        text: t('assistant.error', 'Unable to reach health assistant service. Please check your connectivity or try again.'),
        timestamp: currentTime
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleReadAloud = async (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = currentLanguageDef.locale;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-emerald-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-emerald-700 to-teal-800 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <MessageSquare className="h-5 w-5 text-emerald-100" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{t('assistant.title', 'AyuSync Health Assistant')}</h2>
              <div className="flex items-center gap-2 text-xs text-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                <span>{t('assistant.verified_sources', 'Verified Sources (WHO · ICMR · MoHFW)')}</span>
                <span>·</span>
                <span className="font-medium bg-emerald-900/60 px-2 py-0.5 rounded-full">{currentLanguageDef.nativeName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSimpleMode}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors border ${
                simpleMode
                  ? 'bg-amber-400 text-amber-950 border-amber-300 shadow-sm'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
            >
              {simpleMode ? 'Simple Mode ON' : 'Simple Mode OFF'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-emerald-200 hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                }`}
              >
                {/* Emergency Warning Alert Banner */}
                {msg.emergencyWarning && (
                  <div className="mb-3 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900 flex flex-col gap-2 shadow-2xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">{t('assistant.emergency_alert', 'CRITICAL CLINICAL ALERT:')}</span> {msg.emergencyWarning}
                      </div>
                    </div>
                    <a
                      href="tel:108"
                      className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{t('assistant.call_108', 'Call 108 Ambulance')}</span>
                    </a>
                  </div>
                )}

                <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                {/* Structured Facility Navigation Cards */}
                {msg.structuredData?.facilities && (
                  <div className="mt-3 space-y-2">
                    {msg.structuredData.facilities.map((fac: any) => (
                      <div key={fac.facilityId} className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-gray-900">
                          <span className="flex items-center gap-1">
                            <Building2 size={13} className="text-[#1e6641]" />
                            {fac.facilityName}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e6641] text-white font-semibold">
                            {fac.facilityType}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-600 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Navigation size={11} className="text-gray-400" />
                            {fac.distance_km?.toFixed(1)} km
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1 font-medium text-emerald-800">
                            <Clock size={11} />
                            {fac.estimated_travel_time_minutes} min (ESTIMATED)
                          </span>
                          <span>·</span>
                          <span>Queue: {fac.active_queue_count} patients</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggested Action Chips */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                    {msg.suggestedActions.map((act, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(act)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 border border-gray-200 font-medium transition-colors cursor-pointer"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                )}

                {/* Assistant Footer Buttons (Read Aloud & Citations) */}
                {msg.sender === 'assistant' && (
                  <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-500">
                    <span className="text-[11px] text-gray-400">{msg.timestamp}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleReadAloud(msg.text)}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>{t('action.read_aloud', 'Read Aloud')}</span>
                      </button>
                      {msg.citations && msg.citations.length > 0 && (
                        <button
                          onClick={() => setActiveCitations(msg.citations || null)}
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>{msg.citations.length} Sources</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <div className="h-2 w-2 animate-ping rounded-full bg-emerald-600" />
              <span>{t('assistant.loading', 'Checking verified clinical guidelines & care records...')}</span>
            </div>
          )}
        </div>

        {/* Citations Overlay Drawer */}
        {activeCitations && (
          <div className="border-t border-indigo-100 bg-indigo-50/70 p-3 text-xs">
            <div className="flex items-center justify-between font-semibold text-indigo-900 mb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <span>Verified Public Health Evidence</span>
              </div>
              <button
                onClick={() => setActiveCitations(null)}
                className="text-indigo-700 hover:text-indigo-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {activeCitations.map(c => (
                <div key={c.documentId} className="rounded-lg border border-indigo-200 bg-white p-2 text-gray-700 shadow-2xs">
                  <div className="flex items-center justify-between font-medium text-indigo-950">
                    <span>{c.publisher} · {c.title}</span>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      <span>Link</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="mt-1 text-gray-600 text-[11px] leading-tight">{c.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-2 overflow-x-auto border-t border-gray-100 bg-white px-4 py-2 text-xs">
          <span className="text-gray-400 font-medium whitespace-nowrap">{t('assistant.suggested', 'Suggested:')}</span>
          <button
            onClick={() => handleSendMessage(language.startsWith('hi') ? 'उपलब्ध आईसीयू बेड वाला नजदीकी अस्पताल कौन सा है?' : 'Nearest hospital with available ICU beds?')}
            className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800 border border-emerald-200 hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
          >
            🏥 {t('assistant.chip_icu', 'Nearest ICU Beds')}
          </button>
          <button
            onClick={() => handleSendMessage(language.startsWith('hi') ? 'डेंगू बुखार के मुख्य लक्षण और सावधानियां क्या हैं?' : 'What should I do for severe dengue fever?')}
            className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 whitespace-nowrap cursor-pointer"
          >
            🦟 {t('assistant.chip_dengue', 'Dengue Symptoms (WHO)')}
          </button>
          <button
            onClick={() => handleSendMessage(language.startsWith('hi') ? 'उच्च रक्तचाप (High BP) के खतरे और दिशानिर्देश क्या हैं?' : 'What are blood pressure crisis thresholds?')}
            className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 whitespace-nowrap cursor-pointer"
          >
            🩺 {t('assistant.chip_bp', 'High BP Guidelines (ICMR)')}
          </button>
          <button
            onClick={() => handleSendMessage(language.startsWith('hi') ? 'मेरा अगला उपचार कार्यक्रम या फॉलो-अप कब है?' : 'What is my next care step or follow-up?')}
            className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 border border-indigo-200 hover:bg-indigo-100 whitespace-nowrap cursor-pointer"
          >
            🗓 {t('assistant.chip_schedule', 'My Care Schedule')}
          </button>
        </div>

        {/* Input Footer */}
        <div className="border-t border-gray-200 bg-white p-3 flex items-center gap-2">
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            title={t('action.voice_input', 'Voice Input')}
          >
            <Mic className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder={t(
              'assistant.placeholder',
              `Ask in ${currentLanguageDef.nativeName} (e.g. Nearest ICU, fever guidance)...`
            )}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-hidden"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Voice Confirmation Review Modal */}
        <VoiceInputModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          onConfirm={transcript => {
            setInputText(transcript);
            setIsVoiceModalOpen(false);
          }}
          targetFieldLabel="Health Question / Query"
        />
      </div>
    </div>
  );
};
