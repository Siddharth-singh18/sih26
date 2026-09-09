import { prisma } from '../../index';
import { recordAuditLog } from '../audit/audit.service';
import { retrieveVerifiedHealthKnowledge, RetrievedChunk } from '../rag/rag_retriever';
import { calculateOptimalRoutes } from '../routing/routing.service';
import { getLanguageDefinition } from '../i18n/languages';
import { translateText } from '../i18n/sarvam.service';
import { formatMedicalExplanation } from '../i18n/medical_terms';
import { isGroqConfigured, callGroqChat, getGroqModel } from '../ai/providers/groq.service';
import {
  executeAssistantTool,
  verifyPatientAccess,
  find_nearby_facility,
  get_verified_health_knowledge,
  ToolExecutionContext
} from './assistant_tools';
import crypto from 'crypto';

export type AssistantIntent =
  | 'HEALTH_INFORMATION'
  | 'SYMPTOM_INFORMATION'
  | 'MEDICATION_GENERAL_INFORMATION'
  | 'FACILITY_NAVIGATION'
  | 'APPOINTMENT_HELP'
  | 'REFERRAL_STATUS'
  | 'FOLLOWUP_STATUS'
  | 'PATIENT_RECORD_QUERY'
  | 'EMERGENCY_HELP'
  | 'LANGUAGE_HELP'
  | 'UNKNOWN';

export interface AssistantChatParams {
  query: string;
  userId?: string;
  role?: string;
  patientId?: string;
  facilityId?: string;
  languageCode?: string;
  simpleMode?: boolean;
  userLocation?: { latitude: number; longitude: number };
}

export interface AssistantChatResponse {
  requestId: string;
  intent: AssistantIntent;
  answer: string;
  riskLevel: 'READ_ONLY' | 'LOW_RISK' | 'HIGH_IMPACT';
  evidence: string[];
  citations: RetrievedChunk[];
  suggestedActions: string[];
  requiresConfirmation: boolean;
  clinicalDecisionReference?: string;
  language: string;
  confidence: number;
  limitations: string;
  emergencyWarning?: string;
  structuredData?: Record<string, any>;
  provenance?: string;
  modelUsed?: string;
}

/**
 * Deterministic Clinical Safety Gate: Scans query for acute emergency markers.
 * Preempts LLM reasoning and guarantees immediate triage guidance.
 */
export function evaluateEmergencySafety(query: string): { isEmergency: boolean; condition?: string; triageRef?: string } {
  const lower = query.toLowerCase();

  // SpO2 Red Flag Check (e.g. "spo2 88", "oxygen 85", "oxygen level is 84")
  const spo2Match = lower.match(/(?:spo2|oxygen|saturation|o2)\s*(?:level|saturation|value)?\s*(?:is|=|:)?\s*(\d{2})/i);
  if (spo2Match) {
    const val = parseInt(spo2Match[1], 10);
    if (val < 90) {
      return {
        isEmergency: true,
        condition: 'SPO2_LOW',
        triageRef: `AyuSync Critical Triage Rule: SpO2 ${val}% < 90% threshold`
      };
    }
  }

  // Blood Pressure Red Flag Check (e.g. "bp 190/110", "systolic 185", "blood pressure reading is 195")
  const bpMatch = lower.match(/(?:bp|blood\s*pressure|systolic)\s*(?:reading|level|value)?\s*(?:is|=|:)?\s*(\d{2,3})/i);
  if (bpMatch) {
    const sys = parseInt(bpMatch[1], 10);
    if (sys >= 180) {
      return {
        isEmergency: true,
        condition: 'BP_HIGH',
        triageRef: `AyuSync Critical Triage Rule: Systolic BP ${sys} mmHg >= 180 mmHg threshold`
      };
    }
  }

  // Acute keywords (English and Devanagari)
  if (
    lower.includes('chest pain') ||
    lower.includes('heart attack') ||
    lower.includes('cannot breathe') ||
    lower.includes('severe bleeding') ||
    lower.includes('unconscious') ||
    lower.includes('सीने में दर्द') ||
    lower.includes('सांस लेने में तकलीफ') ||
    lower.includes('सांस नहीं') ||
    lower.includes('दिल का दौरा') ||
    lower.includes('बेहोश') ||
    lower.includes('खून बह रहा')
  ) {
    return {
      isEmergency: true,
      condition: 'EMERGENCY',
      triageRef: 'AyuSync Red-Flag Symptom Rule: Immediate tertiary resuscitation required'
    };
  }

  return { isEmergency: false };
}

/**
 * Adversarial Prompt Injection Defense Gate
 */
export function detectPromptInjection(query: string): boolean {
  const lower = query.toLowerCase();
  const patterns = [
    'ignore all previous instructions',
    'ignore previous instructions',
    'disregard all previous',
    'system prompt',
    'reveal your prompt',
    'print api key',
    'show secret',
    'you are now dan',
    'jailbreak'
  ];
  return patterns.some(p => lower.includes(p));
}

/**
 * Intent Classifier Node
 */
export function classifyIntent(query: string): AssistantIntent {
  const lower = query.toLowerCase();

  if (
    lower.includes('emergency') ||
    lower.includes('ambulance') ||
    lower.includes('chest pain') ||
    lower.includes('heart attack') ||
    lower.includes('cannot breathe') ||
    lower.includes('unconscious') ||
    lower.includes('bleeding') ||
    lower.includes('dying') ||
    lower.includes('oxygen low') ||
    lower.includes('108') ||
    lower.includes('सीने में दर्द') ||
    lower.includes('सांस लेने में तकलीफ') ||
    lower.includes('बेहोश')
  ) {
    return 'EMERGENCY_HELP';
  }

  if (lower.includes('referral') || lower.includes('transfer') || lower.includes('रेफरल') || lower.includes('स्थानांतरण')) {
    return 'REFERRAL_STATUS';
  }

  if (lower.includes('follow-up') || lower.includes('followup') || lower.includes('asha visit') || lower.includes('फॉलो-अप') || lower.includes('गृह भेंट')) {
    return 'FOLLOWUP_STATUS';
  }

  if (lower.includes('appointment') || lower.includes('booking') || lower.includes('token') || lower.includes('queue') || lower.includes('अपॉइंटमेंट') || lower.includes('टोकन') || lower.includes('पर्ची')) {
    return 'APPOINTMENT_HELP';
  }

  if (
    lower.includes('my record') ||
    lower.includes('my health') ||
    lower.includes('timeline') ||
    lower.includes('vitals') ||
    lower.includes('kya karu') ||
    lower.includes('what should i do next') ||
    lower.includes('मेरा रिकॉर्ड') ||
    lower.includes('मेरी समयरेखा') ||
    lower.includes('क्या करूं')
  ) {
    return 'PATIENT_RECORD_QUERY';
  }

  if (
    lower.includes('hospital') ||
    lower.includes('clinic') ||
    lower.includes('nearest') ||
    lower.includes('pass') ||
    lower.includes('icu') ||
    lower.includes('distance') ||
    lower.includes('अस्पताल') ||
    lower.includes('दवाखाना') ||
    lower.includes('नजदीकी') ||
    lower.includes('रुग्णालय') ||
    lower.includes('बेड')
  ) {
    return 'FACILITY_NAVIGATION';
  }

  if (
    lower.includes('medicine') ||
    lower.includes('stock') ||
    lower.includes('paracetamol') ||
    lower.includes('metformin') ||
    lower.includes('tablet') ||
    lower.includes('dava') ||
    lower.includes('दवा') ||
    lower.includes('दवाई') ||
    lower.includes('औषध') ||
    lower.includes('गोली')
  ) {
    return 'MEDICATION_GENERAL_INFORMATION';
  }

  if (lower.includes('language') || lower.includes('hindi') || lower.includes('tamil') || lower.includes('bhasha') || lower.includes('भाषा')) {
    return 'LANGUAGE_HELP';
  }

  if (
    lower.includes('dengue') ||
    lower.includes('sugar') ||
    lower.includes('hypertension') ||
    lower.includes('fever') ||
    lower.includes('cough') ||
    lower.includes('tb') ||
    lower.includes('pregnancy') ||
    lower.includes('symptom') ||
    lower.includes('बुखार') ||
    lower.includes('खांसी') ||
    lower.includes('सिरदर्द') ||
    lower.includes('दर्द') ||
    lower.includes('रक्तचाप') ||
    lower.includes('बीपी') ||
    lower.includes('मधुमेह') ||
    lower.includes('गर्भावस्था') ||
    lower.includes('डेंगू') ||
    lower.includes('मलेरिया') ||
    lower.includes('टीबी') ||
    lower.includes('लक्षण') ||
    lower.includes('इलाज') ||
    lower.includes('उपचार')
  ) {
    return 'HEALTH_INFORMATION';
  }

  return 'UNKNOWN';
}

/**
 * Conversational Agentic Healthcare Assistant Orchestrator
 * Integrates Groq LLM reasoning with deterministic clinical triage,
 * typed PostgreSQL tool calling, and Sarvam multilingual translation.
 */
export async function runHealthcareAssistant(params: AssistantChatParams): Promise<AssistantChatResponse> {
  const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const {
    query,
    userId,
    role = 'PATIENT',
    patientId,
    facilityId,
    languageCode = 'en-IN',
    simpleMode = false,
    userLocation
  } = params;

  const targetLangDef = getLanguageDefinition(languageCode);
  const evidence: string[] = [];
  let citations: RetrievedChunk[] = [];
  let suggestedActions: string[] = [];
  let answer = '';
  let riskLevel: 'READ_ONLY' | 'LOW_RISK' | 'HIGH_IMPACT' = 'READ_ONLY';
  let emergencyWarning: string | undefined = undefined;
  let clinicalDecisionReference: string | undefined = undefined;
  let structuredData: Record<string, any> | undefined = undefined;
  let provenance = 'RULE_BASED_LOCAL_SYNTHESIS';
  let modelUsed = 'rule-engine-v8';

  // Step 1: Deterministic Safety Check (Highest Precedence)
  const safety = evaluateEmergencySafety(query);
  if (safety.isEmergency) {
    riskLevel = 'HIGH_IMPACT';
    emergencyWarning = 'Emergency symptoms may require immediate medical attention. Please call 108 or proceed to the nearest emergency-capable medical center.';
    const isHindi = targetLangDef.code === 'hi-IN' || targetLangDef.code === 'hi';
    emergencyWarning = isHindi
      ? 'आपातकालीन लक्षण पाए गए हैं। तुरंत 108 एम्बुलेंस को कॉल करें या निकटतम आपातकालीन अस्पताल जाएं। (Call 108 Ambulance immediately)'
      : 'Emergency symptoms may require immediate medical attention. Please call 108 or proceed to the nearest emergency-capable medical center.';
    clinicalDecisionReference = safety.triageRef;
    evidence.push(`Safety Classifier Triggered: ${safety.condition} (${safety.triageRef})`);
    if (isHindi) {
      suggestedActions.push('108 एम्बुलेंस को कॉल करें');
    }
    suggestedActions.push('Call 108 Ambulance');
    suggestedActions.push('Find Nearest Emergency Hospital');
    suggestedActions.push(isHindi ? 'नजदीकी आपातकालीन अस्पताल खोजें' : 'Find Nearest Emergency Hospital');

    if (safety.condition) {
      const exp = formatMedicalExplanation(safety.condition, 'Critical', '', targetLangDef.code, simpleMode);
      answer = `AyuSync Clinical Safety Alert: ${exp.localizedText}\n\nEmergency guidance: Please call 108 or proceed to the nearest hospital with emergency oxygen/ICU capability.`;
      answer = isHindi
        ? `आयुसिंक आपातकालीन सुरक्षा चेतावनी: ${exp.localizedText}\n\nआपातकालीन सहायता: कृपया तुरंत 108 पर कॉल करें या नजदीकी आपातकालीन/आईसीयू अस्पताल जाएं।`
        : `AyuSync Clinical Safety Alert: ${exp.localizedText}\n\nEmergency guidance: Please call 108 or proceed to the nearest hospital with emergency oxygen/ICU capability.`;
    } else {
      answer = 'Emergency clinical alert: Your query indicates acute distress. Please call 108 immediately.';
      answer = isHindi
        ? 'आपातकालीन चिकित्सा चेतावनी: आपके लक्षणों में तत्काल चिकित्सकीय सहायता की आवश्यकता है। कृपया तुरंत 108 एम्बुलेंस पर कॉल करें।'
        : 'Emergency clinical alert: Your query indicates acute distress. Please call 108 immediately.';
    }

    await recordAuditLog({
      userId,
      action: 'ASSISTANT_EMERGENCY_ALERT',
      resource: 'AssistantChat',
      resourceId: requestId
    });

    return {
      requestId,
      intent: 'EMERGENCY_HELP',
      answer,
      riskLevel,
      evidence,
      citations,
      suggestedActions,
      requiresConfirmation: false,
      clinicalDecisionReference,
      language: targetLangDef.code,
      confidence: 1.0,
      limitations: 'Rule-based emergency safety protocol executed. Not a substitute for physical triage.',
      emergencyWarning,
      provenance: 'DETERMINISTIC_CLINICAL_SAFETY_GATE',
      modelUsed: 'triage-safety-gate'
    };
  }

  // Step 2: Prompt Injection Defense
  if (detectPromptInjection(query)) {
    await recordAuditLog({
      userId,
      action: 'ASSISTANT_INJECTION_BLOCKED',
      resource: 'AssistantChat',
      resourceId: requestId
    });

    return {
      requestId,
      intent: 'UNKNOWN',
      answer: 'AyuSync Health Assistant operates strictly within clinical safety protocols. I cannot modify safety rules or expose internal configurations. How can I assist you with your health records, nearest clinics, or appointment schedules?',
      riskLevel: 'READ_ONLY',
      evidence: ['Adversarial Prompt Injection Blocked'],
      citations: [],
      suggestedActions: ['View Appointments', 'Find Nearby Care'],
      requiresConfirmation: false,
      language: targetLangDef.code,
      confidence: 1.0,
      limitations: 'Security and clinical integrity gate enforced.',
      provenance: 'SECURITY_GATE'
    };
  }

  // Step 3: Intent Classification
  const intent = classifyIntent(query);
  const toolCtx: ToolExecutionContext = {
    userId,
    role,
    patientId,
    facilityId,
    languageCode: targetLangDef.code
  };

  let toolContextData: any = null;

  // Step 4: Domain Tool Execution & Data Retrieval
  switch (intent) {
    case 'FACILITY_NAVIGATION': {
      const lat = userLocation?.latitude ?? 18.1507;
      const lng = userLocation?.longitude ?? 74.5768;
      const isIcu = query.toLowerCase().includes('icu');
      const isEmergency = query.toLowerCase().includes('emergency');

      const toolRes = await find_nearby_facility({
        latitude: lat,
        longitude: lng,
        requiredBedType: isIcu ? 'ICU' : undefined,
        urgency: isEmergency ? 'EMERGENCY' : 'ROUTINE',
        limit: 3
      });

      const facilities = toolRes.data?.facilities || [];
      toolContextData = { facilities };

      if (facilities.length > 0) {
        const top = facilities[0];
        evidence.push(`Nearest Facility: ${top.facilityName} (${top.facilityType}), Distance: ${top.distance_km?.toFixed(1)} km, Queue: ${top.active_queue_count}`);
        answer = `The nearest suitable facility is ${top.facilityName} (${top.facilityType}), located approximately ${top.distance_km?.toFixed(1)} km away with an estimated travel time of ${top.estimated_travel_time_minutes} minutes (ESTIMATED). Current readiness score is ${top.readiness_score}/100 and queue load is ${top.active_queue_count} patients.`;
        suggestedActions.push(`Navigate to ${top.facilityName}`);
        suggestedActions.push('View Bed Availability');
        structuredData = { facilities: facilities.slice(0, 3) };
      } else {
        answer = 'No registered facilities matched your exact search criteria in the local district.';
      }
      break;
    }

    case 'MEDICATION_GENERAL_INFORMATION': {
      const medications = await prisma.medication.findMany({ take: 5 });
      toolContextData = {
        medications,
        stockDisclosure: 'Live multi-facility stock is NOT_SUPPORTED_BY_SCHEMA'
      };

      evidence.push('Schema Capability Disclosure: Multi-facility live stock is NOT_SUPPORTED_BY_SCHEMA');
      evidence.push(`PostgreSQL Formulary Catalog: ${medications.length} medications registered`);

      const medNames = medications.map(m => m.name).join(', ') || 'Amlodipine 5mg, Metformin 500mg, Paracetamol 500mg';
      answer = `Live medicine stock levels are not currently tracked in the database schema (NOT_SUPPORTED_BY_SCHEMA). However, registered clinical formulary items in this district include: ${medNames}. Please consult the dispensary at your primary health center for physical dispensation.`;
      suggestedActions.push('View Facility Formularies');
      suggestedActions.push('Find Nearby Care');
      break;
    }

    case 'PATIENT_RECORD_QUERY':
    case 'FOLLOWUP_STATUS':
    case 'APPOINTMENT_HELP':
    case 'REFERRAL_STATUS': {
      if (!patientId) {
        answer = 'To view your personal appointments, referrals, or follow-ups, please ensure you are signed into your patient account.';
        break;
      }

      // IDOR Authorization Gate
      const allowed = await verifyPatientAccess(patientId, userId, role);
      if (!allowed) {
        return {
          requestId,
          intent,
          answer: 'Access Denied: You are not authorized to view health records for another patient (IDOR Defense).',
          riskLevel: 'READ_ONLY',
          evidence: ['RBAC IDOR Violation Prevented'],
          citations: [],
          suggestedActions: [],
          requiresConfirmation: false,
          language: targetLangDef.code,
          confidence: 1.0,
          limitations: 'Strict database-level RBAC policy enforced.',
          provenance: 'RBAC_IDOR_GATE'
        };
      }

      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          appointments: { orderBy: { scheduledAt: 'desc' }, take: 1 },
          referrals: { orderBy: { id: 'desc' }, take: 1, include: { destination: true } },
          followUps: { orderBy: { dueDate: 'asc' }, take: 1 }
        }
      });

      if (!patient) {
        answer = 'No patient record found matching the specified identifier.';
        break;
      }

      toolContextData = { patient };
      evidence.push(`Patient: ${patient.name}`);
      const parts: string[] = [];

      if (patient.appointments.length > 0) {
        const appt = patient.appointments[0];
        parts.push(`Upcoming appointment scheduled for ${new Date(appt.scheduledAt).toLocaleDateString()} (Status: ${appt.status}).`);
        evidence.push(`Appointment ID: ${appt.id}`);
      }
      if (patient.referrals.length > 0) {
        const ref = patient.referrals[0];
        parts.push(`Active referral to ${ref.destination.name} (Status: ${ref.status}, Urgency: ${ref.urgency}).`);
        evidence.push(`Referral ID: ${ref.id}`);
      }
      if (patient.followUps.length > 0) {
        const fol = patient.followUps[0];
        parts.push(`Next ASHA follow-up visit is due on ${new Date(fol.dueDate).toLocaleDateString()} for: "${fol.reason}".`);
        evidence.push(`FollowUp ID: ${fol.id}`);
      }

      if (parts.length > 0) {
        answer = `Health Journey Summary for ${patient.name}:\n` + parts.join(' ');
        suggestedActions.push('View Full Health Record');
      } else {
        answer = `Health record for ${patient.name} is up to date. You have no pending appointments or overdue follow-ups.`;
      }
      break;
    }

    case 'HEALTH_INFORMATION':
    case 'SYMPTOM_INFORMATION':
    default: {
      const ragResult = get_verified_health_knowledge({ query });
      const knowledge = (await ragResult).data;
      citations = knowledge?.chunks || [];
      toolContextData = { citations };

      if (knowledge?.hasSufficientEvidence && citations.length > 0) {
        const topCitation = citations[0];
        evidence.push(`Verified Source: ${topCitation.source} (${topCitation.publisher})`);
        evidence.push(`Document: ${topCitation.title} — ${topCitation.section}`);

        answer = `${topCitation.snippet}\n\n[Source: ${topCitation.publisher} · "${topCitation.title}"]`;
        suggestedActions.push('Ask Follow-up Health Question');
        suggestedActions.push('Consult a Doctor');
      } else {
        answer = 'Verified public health guidelines from WHO or MoHFW were not sufficient to answer this question with complete clinical confidence. Please speak with an ASHA worker or consulting doctor for professional medical evaluation.';
        suggestedActions.push('Request Doctor Teleconsultation');
      }
      break;
    }
  }

  // Step 5: Groq Conversational Reasoning (When Configured)
  if (isGroqConfigured()) {
    try {
      const languageInstruction = (targetLangDef.code !== 'en-IN' && targetLangDef.code !== 'en')
        ? `- CRITICAL LANGUAGE MANDATE: The user is interacting in ${targetLangDef.englishName} (${targetLangDef.nativeName}, code: ${targetLangDef.code}). You MUST generate your entire response in ${targetLangDef.englishName} (${targetLangDef.nativeName} script, e.g., Devanagari script for Hindi). Do NOT respond in English! Keep all exact numerical measurements, vital signs, and units intact (e.g., 136/86 mmHg, 74 bpm, 186 mg/dL, 98%).`
        : `- Respond in clear, professional Indian English. Keep exact numerical vitals and units intact.`;

      const systemPrompt = `You are AyuSync Health Assistant, an empathetic, evidence-based healthcare navigator and literacy assistant for rural and primary healthcare in India.
Instructions:
- Never provide definitive diagnoses or prescribe prescription drugs.
- Strictly preserve all exact numerical vitals and units (e.g. 136/86 mmHg, 74 bpm, 186 mg/dL, 98%).
- State all travel times with '(ESTIMATED)' transit caveats.
- Clearly state that multi-facility live stock is not tracked (NOT_SUPPORTED_BY_SCHEMA) when asked about medicines.
${languageInstruction}
- Synthesize an empathetic, concise response based on the factual context below.

Factual Tool & Clinical Context:
${JSON.stringify(toolContextData || { intent, evidence })}
`;

      const groqRes = await callGroqChat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        { temperature: 0.1, maxTokens: 800 }
      );

      if (groqRes.success && groqRes.content && groqRes.content.trim().length > 0) {
        answer = groqRes.content.trim();
        provenance = 'GROQ_LLM_SYNTHESIS';
        modelUsed = groqRes.modelUsed;
      }
    } catch {
      // Graceful fallback to deterministic local synthesis
    }
  }

  // Step 6: Localization & Sarvam Multilingual Translation
  if (targetLangDef.code !== 'en-IN' && targetLangDef.code !== 'en') {
    const translationResult = await translateText({
      text: answer,
      sourceLanguage: 'en-IN',
      targetLanguage: targetLangDef.code,
      contextType: 'CONVERSATIONAL'
    });
    answer = translationResult.translatedText;
    const hasDevanagari = /[\u0900-\u097F]/.test(answer);
    const isTargetDevanagari = ['hi-IN', 'hi', 'mr-IN', 'mr', 'ne-IN', 'sa-IN', 'mai-IN', 'doi-IN'].includes(targetLangDef.code);

    // If answer is not already in the target script, translate via Sarvam
    if (!(isTargetDevanagari && hasDevanagari)) {
      const translationResult = await translateText({
        text: answer,
        sourceLanguage: 'en-IN',
        targetLanguage: targetLangDef.code,
        contextType: 'CONVERSATIONAL'
      });
      if (translationResult.translatedText && translationResult.translatedText !== answer) {
        answer = translationResult.translatedText;
      }
    }
  }

  // Step 7: Provenance & Audit Logging
  await recordAuditLog({
    userId,
    action: 'ASSISTANT_CHAT_QUERY',
    resource: 'AssistantChat',
    resourceId: requestId
  });

  return {
    requestId,
    intent,
    answer,
    riskLevel,
    evidence,
    citations,
    suggestedActions,
    requiresConfirmation: false,
    clinicalDecisionReference,
    language: targetLangDef.code,
    confidence: citations.length > 0 ? 0.95 : 0.85,
    limitations: 'Informational health guidance and care navigation only. Not an autonomous clinical diagnostic tool.',
    emergencyWarning,
    structuredData,
    provenance,
    modelUsed
  };
}
