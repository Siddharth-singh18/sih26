import { prisma } from '../../index';
import { recordAuditLog } from '../audit/audit.service';
import { getFacilityOperationalMetrics } from '../analytics/analytics.service';
import { getDistrictOperationalPredictionsSummary } from '../prediction/prediction.service';
import crypto from 'crypto';

/**
 * CONTROLLED AGENTIC AI ORCHESTRATION GRAPH
 * Deterministic LangGraph-style state machine with strict safety boundaries,
 * human-in-the-loop approval gates, complete provenance, and bilingual responses.
 */

export type AgentIntent =
  | 'CARE_COORDINATION'
  | 'REFERRAL_CLOSURE'
  | 'FACILITY_OPERATIONS'
  | 'FOLLOWUP_GAP';

export type ActionRiskLevel = 'READ_ONLY' | 'LOW_RISK' | 'HIGH_IMPACT';

export interface AgentProposedAction {
  id: string;
  actionType: string;
  targetEntity: string;
  targetEntityId: string;
  payload: Record<string, any>;
  riskLevel: ActionRiskLevel;
  requiresHumanApproval: boolean;
}

export interface AgentState {
  requestId: string;
  userId?: string;
  role?: string;
  patientId?: string;
  facilityId?: string;
  referralId?: string;
  intent: AgentIntent;
  
  // Context & Evidence
  clinicalContext?: Record<string, any>;
  facilityContext?: Record<string, any>;
  referralContext?: Record<string, any>;
  queueContext?: Record<string, any>;
  predictionContext?: Record<string, any>;
  retrievedEvidence: string[];
  
  // Evaluation & Decision
  recommendation: string;
  localizedMessages: {
    en: string;
    hi: string;
  };
  healthLiteracyExplanation?: {
    en: string;
    hi: string;
  };
  riskLevel: ActionRiskLevel;
  requiresHumanApproval: boolean;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';
  
  // Proposed & Executed Actions
  proposedActions: AgentProposedAction[];
  executedActions: string[];
  
  // Provenance & Audit
  provenance: {
    agentType: string;
    graphVersion: string;
    decisionEngine: 'RULE_BASED_AGENTIC_GRAPH';
    externalModel: 'BLOCKED_EXTERNAL' | 'CONNECTED';
    confidence: number;
    timestamp: string;
    evidenceIds: string[];
  };
  errors: string[];
}

// In-memory registry of pending high-impact agent recommendations
export const pendingAgentRecommendations = new Map<string, AgentState>();

/**
 * Node 1: Context Retrieval Node
 */
async function retrieveContext(state: AgentState): Promise<AgentState> {
  const evidence: string[] = [];

  if (state.patientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: state.patientId },
      include: {
        encounters: {
          orderBy: { start: 'desc' },
          take: 3,
          include: { vitals: true, prescriptions: true, clinicalObs: true }
        },
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 2,
          include: { symptoms: true, aiRecommendations: true }
        },
        referrals: {
          orderBy: { id: 'desc' },
          take: 2,
          include: { events: true, origin: true, destination: true }
        },
        followUps: {
          orderBy: { dueDate: 'desc' },
          take: 3
        }
      }
    });

    if (patient) {
      state.clinicalContext = {
        patientId: patient.id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        latestEncounter: patient.encounters[0] || null,
        latestAssessment: patient.assessments[0] || null,
        activeReferrals: patient.referrals.filter(r => !['COMPLETED', 'CANCELLED'].includes(r.status)),
        pendingFollowUps: patient.followUps.filter(f => f.status !== 'COMPLETED')
      };
      evidence.push(`PatientRecord:${patient.id}`);
      if (patient.encounters[0]) evidence.push(`Encounter:${patient.encounters[0].id}`);
      if (patient.referrals[0]) evidence.push(`Referral:${patient.referrals[0].id}`);
    }
  }

  if (state.facilityId) {
    const facility = await prisma.facility.findUnique({
      where: { id: state.facilityId },
      include: {
        availability: true,
        capacities: true,
        appointments: {
          where: { status: 'BOOKED' },
          take: 10
        }
      }
    });

    if (facility) {
      const activeQueue = await prisma.queueEntry.count({
        where: {
          status: { in: ['WAITING', 'PRIORITY', 'IN_CONSULTATION'] },
          appointment: { facilityId: facility.id }
        }
      });

      state.facilityContext = {
        facilityId: facility.id,
        name: facility.name,
        status: facility.availability?.status || 'OPEN',
        readinessScore: facility.availability?.readinessScore || 80,
        capacities: facility.capacities,
        activeQueue
      };
      evidence.push(`Facility:${facility.id}`);
    }
  }

  state.retrievedEvidence = evidence;
  return state;
}

/**
 * Node 2: Intent Analysis & Domain Execution Node
 */
async function analyzeDomain(state: AgentState): Promise<AgentState> {
  const actions: AgentProposedAction[] = [];
  const actionId = `act_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  switch (state.intent) {
    case 'CARE_COORDINATION': {
      const clinical = state.clinicalContext;
      const latestEnc = clinical?.latestEncounter;
      const pendingFollowUps = clinical?.pendingFollowUps || [];

      if (latestEnc && latestEnc.status === 'COMPLETED' && pendingFollowUps.length === 0) {
        state.recommendation = 'Clinical consultation was completed, but no follow-up continuity task exists. Recommend scheduling an ASHA post-consultation visit.';
        state.localizedMessages = {
          en: 'Clinical consultation was completed. Scheduled community follow-up task is recommended.',
          hi: 'डॉक्टर द्वारा परामर्श पूर्ण हुआ। आशा कार्यकर्ता द्वारा अनुवर्ती गृह-भेंट (फॉलो-अप) का कार्य निर्धारित करने की सलाह दी जाती है।'
        };
        state.healthLiteracyExplanation = {
          en: 'Your doctor visit is finished. A village health worker will visit you at home to check your recovery and medicines.',
          hi: 'डॉक्टर की जांच पूरी हो गई है। गांव की स्वास्थ्य कार्यकर्ता आपके घर आकर दवा और स्वास्थ्य की जांच करेंगी।'
        };
        state.riskLevel = 'HIGH_IMPACT';
        state.requiresHumanApproval = true;

        actions.push({
          id: actionId,
          actionType: 'CREATE_FOLLOW_UP_TASK',
          targetEntity: 'FollowUp',
          targetEntityId: clinical?.patientId,
          payload: {
            patientId: clinical?.patientId,
            reason: 'Post-consultation medication compliance & vitals verification',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          },
          riskLevel: 'HIGH_IMPACT',
          requiresHumanApproval: true
        });
      } else {
        state.recommendation = 'Patient care coordination is on track with active follow-up tasks documented.';
        state.localizedMessages = {
          en: 'Patient care continuity is active with verified follow-up tasks.',
          hi: 'मरीज की देखभाल योजना सुचारू रूप से चल रही है और अनुवर्ती कार्य दर्ज हैं।'
        };
        state.riskLevel = 'READ_ONLY';
        state.requiresHumanApproval = false;
      }
      break;
    }

    case 'REFERRAL_CLOSURE': {
      const clinical = state.clinicalContext;
      const activeRefs = clinical?.activeReferrals || [];
      const stuckRef = activeRefs.find((r: any) => r.status === 'SUBMITTED' || r.status === 'ACCEPTED');

      if (stuckRef) {
        state.recommendation = `Referral ${stuckRef.id} to ${stuckRef.destination?.name || 'facility'} is awaiting consultation closure. Recommend priority status review and coordination ping.`;
        state.localizedMessages = {
          en: `Transfer referral to ${stuckRef.destination?.name || 'destination facility'} is awaiting final counter-referral closure.`,
          hi: `${stuckRef.destination?.name || 'अस्पताल'} के लिए रेफरल प्रक्रिया जारी है। परामर्श पूरा होने पर रिपोर्ट दर्ज करने की सलाह दी जाती है।`
        };
        state.healthLiteracyExplanation = {
          en: 'Your hospital referral is active. The specialist hospital is reviewing your case.',
          hi: 'आपके बड़े अस्पताल का रेफरल चालू है। विशेषज्ञ डॉक्टर आपके केस की जांच कर रहे हैं।'
        };
        state.riskLevel = 'LOW_RISK';
        state.requiresHumanApproval = false;

        actions.push({
          id: actionId,
          actionType: 'SEND_COORDINATION_ALERT',
          targetEntity: 'Referral',
          targetEntityId: stuckRef.id,
          payload: { referralId: stuckRef.id, notice: 'Referral closure check' },
          riskLevel: 'LOW_RISK',
          requiresHumanApproval: false
        });
      } else {
        state.recommendation = 'Zero active stalled referrals identified for this patient record.';
        state.localizedMessages = {
          en: 'No pending or stalled referrals identified.',
          hi: 'कोई लंबित या रुका हुआ रेफरल नहीं पाया गया।'
        };
        state.riskLevel = 'READ_ONLY';
        state.requiresHumanApproval = false;
      }
      break;
    }

    case 'FACILITY_OPERATIONS': {
      const facility = state.facilityContext;
      const activeQueue = facility?.activeQueue || 0;
      const icu = facility?.capacities?.find((c: any) => c.resource.toUpperCase().includes('ICU'));
      const icuAvail = icu ? Math.max(0, icu.total - icu.occupied) : 999;

      if (facility?.status === 'OVERCAPACITY' || icuAvail === 0) {
        state.recommendation = `Critical resource pressure at ${facility?.name || 'facility'} (ICU Available: ${icuAvail}, Queue: ${activeQueue}). Recommend reviewing emergency routing diversion to alternate secondary network.`;
        state.localizedMessages = {
          en: `Critical bed capacity pressure at ${facility?.name || 'facility'}. Emergency diversion evaluation recommended.`,
          hi: `${facility?.name || 'अस्पताल'} में आपातकालीन बेड की कमी है। गंभीर मरीजों को अन्य सक्षम अस्पताल में भेजने की समीक्षा करें।`
        };
        state.riskLevel = 'HIGH_IMPACT';
        state.requiresHumanApproval = true;

        actions.push({
          id: actionId,
          actionType: 'UPDATE_AVAILABILITY_STATE',
          targetEntity: 'FacilityAvailability',
          targetEntityId: facility?.facilityId,
          payload: { status: 'OVERCAPACITY', readinessScore: 65 },
          riskLevel: 'HIGH_IMPACT',
          requiresHumanApproval: true
        });
      } else {
        state.recommendation = `${facility?.name || 'Facility'} operations are within safe operational thresholds.`;
        state.localizedMessages = {
          en: `${facility?.name || 'Facility'} is operating within normal capacity limits.`,
          hi: `${facility?.name || 'अस्पताल'} की व्यवस्था सामान्य सीमा के भीतर कार्य कर रही है।`
        };
        state.riskLevel = 'READ_ONLY';
        state.requiresHumanApproval = false;
      }
      break;
    }

    case 'FOLLOWUP_GAP': {
      const overdueFollowups = await prisma.followUp.count({
        where: { status: 'PENDING', dueDate: { lt: new Date() } }
      });

      if (overdueFollowups > 0) {
        state.recommendation = `Detected ${overdueFollowups} overdue community follow-up care gaps. Recommend prioritized task re-assignment to village ASHA workers.`;
        state.localizedMessages = {
          en: `${overdueFollowups} community follow-up tasks are overdue for home visits.`,
          hi: `${overdueFollowups} मरीजों की फॉलो-अप गृह-भेंट की तारीख निकल चुकी है। आशा कार्यकर्ताओं को प्राथमिकता कार्य सौंपने की सलाह दी जाती है।`
        };
        state.healthLiteracyExplanation = {
          en: 'Your follow-up visit is due. Your village ASHA worker will check your blood pressure and medicines at home.',
          hi: 'आपकी जांच का समय हो गया है। आपकी आशा कार्यकर्ता आपके घर आकर दवा और स्वास्थ्य की जांच करेंगी।'
        };
        state.riskLevel = 'LOW_RISK';
        state.requiresHumanApproval = false;

        actions.push({
          id: actionId,
          actionType: 'NOTIFY_OVERDUE_FOLLOWUPS',
          targetEntity: 'FollowUp',
          targetEntityId: 'overdue-cohort',
          payload: { count: overdueFollowups },
          riskLevel: 'LOW_RISK',
          requiresHumanApproval: false
        });
      } else {
        state.recommendation = 'Zero overdue follow-up care gaps detected in the system.';
        state.localizedMessages = {
          en: 'All community follow-up tasks are on schedule.',
          hi: 'सभी फॉलो-अप कार्य समय पर पूर्ण हो रहे हैं।'
        };
        state.healthLiteracyExplanation = {
          en: 'All community health follow-up tasks are up to date.',
          hi: 'आपकी सभी स्वास्थ्य जांच समय पर पूरी हो चुकी हैं।'
        };
        state.riskLevel = 'READ_ONLY';
        state.requiresHumanApproval = false;
      }
      break;
    }
  }

  state.proposedActions = actions;
  return state;
}

/**
 * Node 3: Safety Validation & Approval Gate Node
 */
async function evaluateSafetyGate(state: AgentState): Promise<AgentState> {
  const hasHighImpact = state.proposedActions.some(a => a.riskLevel === 'HIGH_IMPACT');

  if (hasHighImpact || state.riskLevel === 'HIGH_IMPACT') {
    state.requiresHumanApproval = true;
    state.approvalStatus = 'PENDING';
    pendingAgentRecommendations.set(state.requestId, state);
  } else {
    state.requiresHumanApproval = false;
    state.approvalStatus = 'NOT_REQUIRED';
  }

  return state;
}

/**
 * Node 4: Audit & Provenance Node
 */
async function stampAudit(state: AgentState): Promise<AgentState> {
  state.provenance = {
    agentType: state.intent,
    graphVersion: 'langgraph-orchestration-v1.0.0',
    decisionEngine: 'RULE_BASED_AGENTIC_GRAPH',
    externalModel: 'BLOCKED_EXTERNAL', // Honestly reported without fake external generative API tokens
    confidence: 1.0,
    timestamp: new Date().toISOString(),
    evidenceIds: state.retrievedEvidence
  };

  await recordAuditLog({
    userId: state.userId || null,
    action: `AGENT_GRAPH_${state.intent}_EVALUATED`,
    resource: 'AgentGraphState',
    resourceId: state.requestId
  });

  return state;
}

/**
 * Orchestration Pipeline Entry Point (Linear DAG)
 */
export async function runAgentGraph(params: {
  intent: AgentIntent;
  userId?: string;
  role?: string;
  patientId?: string;
  facilityId?: string;
  referralId?: string;
}): Promise<AgentState> {
  let state: AgentState = {
    requestId: `graph_req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    userId: params.userId,
    role: params.role,
    patientId: params.patientId,
    facilityId: params.facilityId,
    referralId: params.referralId,
    intent: params.intent,
    retrievedEvidence: [],
    recommendation: '',
    localizedMessages: { en: '', hi: '' },
    riskLevel: 'READ_ONLY',
    requiresHumanApproval: false,
    approvalStatus: 'NOT_REQUIRED',
    proposedActions: [],
    executedActions: [],
    provenance: {
      agentType: params.intent,
      graphVersion: 'v1',
      decisionEngine: 'RULE_BASED_AGENTIC_GRAPH',
      externalModel: 'BLOCKED_EXTERNAL',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      evidenceIds: []
    },
    errors: []
  };

  // Execute Graph Nodes Sequentially
  state = await retrieveContext(state);
  state = await analyzeDomain(state);
  state = await evaluateSafetyGate(state);
  state = await stampAudit(state);

  return state;
}

/**
 * Human Clinical Approval Execution Node
 */
export async function approveAgentGraphAction(
  requestId: string,
  approvingUserId: string,
  approverRoles: string[] = []
): Promise<{ success: boolean; message: string; state?: AgentState }> {
  const state = pendingAgentRecommendations.get(requestId);
  if (!state) {
    return { success: false, message: 'Agent recommendation not found or already executed' };
  }

  const isAuthorized = approverRoles.includes('ADMIN') || approverRoles.includes('DOCTOR');
  if (!isAuthorized) {
    return { success: false, message: 'Forbidden: Doctor or Administrator role required to approve agent actions' };
  }

  // Execute proposed actions through authentic database services
  for (const action of state.proposedActions) {
    if (action.actionType === 'CREATE_FOLLOW_UP_TASK') {
      await prisma.followUp.create({
        data: {
          patientId: action.payload.patientId,
          reason: action.payload.reason,
          dueDate: new Date(action.payload.dueDate),
          status: 'PENDING'
        }
      });
      state.executedActions.push(`Created FollowUp task for patient ${action.payload.patientId}`);
    } else if (action.actionType === 'UPDATE_AVAILABILITY_STATE') {
      await prisma.facilityAvailability.update({
        where: { facilityId: action.targetEntityId },
        data: {
          status: action.payload.status,
          readinessScore: action.payload.readinessScore
        }
      });
      state.executedActions.push(`Updated facility ${action.targetEntityId} to ${action.payload.status}`);
    }
  }

  state.approvalStatus = 'APPROVED';
  pendingAgentRecommendations.delete(requestId);

  await recordAuditLog({
    userId: approvingUserId,
    action: `AGENT_GRAPH_ACTION_APPROVED`,
    resource: 'AgentGraphState',
    resourceId: requestId
  });

  return {
    success: true,
    message: 'Agent proposed action successfully approved and executed through authorized services',
    state
  };
}

/**
 * Human Rejection Node
 */
export async function rejectAgentGraphAction(
  requestId: string,
  rejectingUserId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const state = pendingAgentRecommendations.get(requestId);
  if (!state) {
    return { success: false, message: 'Agent recommendation not found or already processed' };
  }

  state.approvalStatus = 'REJECTED';
  pendingAgentRecommendations.delete(requestId);

  await recordAuditLog({
    userId: rejectingUserId,
    action: `AGENT_GRAPH_ACTION_REJECTED`,
    resource: 'AgentGraphState',
    resourceId: requestId
  });

  return {
    success: true,
    message: `Agent recommendation rejected safely by human clinician: ${reason}`
  };
}
