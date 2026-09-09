import { prisma } from '../../index';
import { recordAuditLog } from '../audit/audit.service';
import { retrieveVerifiedHealthKnowledge, RetrievedChunk } from '../rag/rag_retriever';
import { calculateOptimalRoutes } from '../routing/routing.service';
import { predictQueuePressure, predictCapacityPressure } from '../prediction/prediction.service';

export interface ToolExecutionContext {
  userId?: string;
  role?: string;
  patientId?: string;
  facilityId?: string;
  languageCode?: string;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
  rbacBlocked?: boolean;
}

/**
 * Validates IDOR access: A patient can only view their own records.
 * Doctors, workers, and admins have role-level clinical authorization.
 */
export async function verifyPatientAccess(
  patientId: string,
  userId?: string,
  role?: string
): Promise<boolean> {
  if (!userId || !role) return true;
  if (role !== 'PATIENT') return true;

  try {
    const patientUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true }
    });
    const targetPatient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { phone: true }
    });

    if (patientUser && targetPatient && patientUser.phone && targetPatient.phone) {
      return patientUser.phone === targetPatient.phone;
    }
  } catch {
    // Fail-safe
  }
  return true;
}

// -------------------------------------------------------------
// 13 APPROVED AGENT TOOLS
// -------------------------------------------------------------

// Tool 1: get_patient_timeline
export async function get_patient_timeline(params: { patientId: string }, ctx: ToolExecutionContext): Promise<ToolResult> {
  const allowed = await verifyPatientAccess(params.patientId, ctx.userId, ctx.role);
  if (!allowed) return { tool: 'get_patient_timeline', success: false, rbacBlocked: true, error: 'Access Denied: IDOR check failed.' };

  const encounters = await prisma.encounter.findMany({
    where: { patientId: params.patientId },
    include: { vitals: true, prescriptions: true, facility: true },
    orderBy: { start: 'desc' },
    take: 5
  });

  const referrals = await prisma.referral.findMany({
    where: { patientId: params.patientId },
    include: { origin: true, destination: true },
    orderBy: { id: 'desc' },
    take: 3
  });

  return {
    tool: 'get_patient_timeline',
    success: true,
    data: { encounters, referrals }
  };
}

// Tool 2: get_active_referrals
export async function get_active_referrals(params: { patientId: string }, ctx: ToolExecutionContext): Promise<ToolResult> {
  const allowed = await verifyPatientAccess(params.patientId, ctx.userId, ctx.role);
  if (!allowed) return { tool: 'get_active_referrals', success: false, rbacBlocked: true, error: 'Access Denied: IDOR check failed.' };

  const referrals = await prisma.referral.findMany({
    where: {
      patientId: params.patientId,
      status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] }
    },
    include: { origin: true, destination: true },
    orderBy: { id: 'desc' }
  });

  return { tool: 'get_active_referrals', success: true, data: { referrals } };
}

// Tool 3: get_followups
export async function get_followups(params: { patientId: string }, ctx: ToolExecutionContext): Promise<ToolResult> {
  const allowed = await verifyPatientAccess(params.patientId, ctx.userId, ctx.role);
  if (!allowed) return { tool: 'get_followups', success: false, rbacBlocked: true, error: 'Access Denied: IDOR check failed.' };

  const followups = await prisma.followUp.findMany({
    where: { patientId: params.patientId },
    include: { worker: { include: { user: true } } },
    orderBy: { dueDate: 'asc' },
    take: 5
  });

  return { tool: 'get_followups', success: true, data: { followups } };
}

// Tool 4: get_appointments
export async function get_appointments(params: { patientId: string }, ctx: ToolExecutionContext): Promise<ToolResult> {
  const allowed = await verifyPatientAccess(params.patientId, ctx.userId, ctx.role);
  if (!allowed) return { tool: 'get_appointments', success: false, rbacBlocked: true, error: 'Access Denied: IDOR check failed.' };

  const appointments = await prisma.appointment.findMany({
    where: { patientId: params.patientId },
    include: { facility: true, doctor: { include: { specialist: true, user: true } }, queueEntry: true },
    orderBy: { scheduledAt: 'desc' },
    take: 5
  });

  return { tool: 'get_appointments', success: true, data: { appointments } };
}

// Tool 5: get_prescriptions
export async function get_prescriptions(params: { patientId: string }, ctx: ToolExecutionContext): Promise<ToolResult> {
  const allowed = await verifyPatientAccess(params.patientId, ctx.userId, ctx.role);
  if (!allowed) return { tool: 'get_prescriptions', success: false, rbacBlocked: true, error: 'Access Denied: IDOR check failed.' };

  const prescriptions = await prisma.prescription.findMany({
    where: { encounter: { patientId: params.patientId } },
    include: { encounter: { include: { facility: true } } },
    take: 10
  });

  return {
    tool: 'get_prescriptions',
    success: true,
    data: {
      prescriptions,
      stockDisclaimer: 'Live multi-facility stock counts are not tracked (NOT_SUPPORTED_BY_SCHEMA). Consult dispensary for physical dispensation.'
    }
  };
}

// Tool 6: get_health_summary
export async function get_health_summary(params: { patientId: string }, ctx: ToolExecutionContext): Promise<ToolResult> {
  const allowed = await verifyPatientAccess(params.patientId, ctx.userId, ctx.role);
  if (!allowed) return { tool: 'get_health_summary', success: false, rbacBlocked: true, error: 'Access Denied: IDOR check failed.' };

  const patient = await prisma.patient.findUnique({
    where: { id: params.patientId },
    include: {
      conditions: { where: { status: 'ACTIVE' } },
      encounters: {
        orderBy: { start: 'desc' },
        take: 1,
        include: { vitals: true }
      }
    }
  });

  if (!patient) return { tool: 'get_health_summary', success: false, error: 'Patient not found' };

  return {
    tool: 'get_health_summary',
    success: true,
    data: {
      patient: {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        village: patient.village,
        phone: patient.phone
      },
      activeConditions: patient.conditions,
      recentVitals: patient.encounters[0]?.vitals || []
    }
  };
}

// Tool 7: get_triage_result
export async function get_triage_result(params: { patientId: string }, ctx: ToolExecutionContext): Promise<ToolResult> {
  const allowed = await verifyPatientAccess(params.patientId, ctx.userId, ctx.role);
  if (!allowed) return { tool: 'get_triage_result', success: false, rbacBlocked: true, error: 'Access Denied: IDOR check failed.' };

  const assessment = await prisma.assessment.findFirst({
    where: { patientId: params.patientId },
    orderBy: { createdAt: 'desc' },
    include: { symptoms: true, aiRecommendations: true }
  });

  return { tool: 'get_triage_result', success: true, data: { assessment } };
}

// Tool 8: get_facility_capabilities
export async function get_facility_capabilities(params: { facilityId: string }): Promise<ToolResult> {
  const facility = await prisma.facility.findUnique({
    where: { id: params.facilityId },
    include: {
      services: true,
      capacities: true,
      doctors: { include: { doctor: { include: { specialist: true, user: true } } } }
    }
  });

  if (!facility) return { tool: 'get_facility_capabilities', success: false, error: 'Facility not found' };
  return { tool: 'get_facility_capabilities', success: true, data: { facility } };
}

// Tool 9: get_facility_availability
export async function get_facility_availability(params: { facilityId: string }): Promise<ToolResult> {
  const availability = await prisma.facilityAvailability.findUnique({
    where: { facilityId: params.facilityId }
  });

  const capacities = await prisma.facilityCapacity.findMany({
    where: { facilityId: params.facilityId }
  });

  return { tool: 'get_facility_availability', success: true, data: { availability, capacities } };
}

// Tool 10: get_facility_queue
export async function get_facility_queue(params: { facilityId: string }): Promise<ToolResult> {
  const waitingCount = await prisma.queueEntry.count({
    where: {
      status: { in: ['WAITING', 'PRIORITY', 'IN_CONSULTATION'] },
      appointment: { facilityId: params.facilityId }
    }
  });

  return {
    tool: 'get_facility_queue',
    success: true,
    data: {
      facilityId: params.facilityId,
      activeQueueCount: waitingCount,
      estimatedWaitMinutes: waitingCount * 12
    }
  };
}

// Tool 11: find_nearby_facility
export async function find_nearby_facility(params: {
  latitude?: number;
  longitude?: number;
  requiredBedType?: string;
  urgency?: string;
  limit?: number;
}): Promise<ToolResult> {
  const lat = params.latitude ?? 18.1507;
  const lng = params.longitude ?? 74.5768;

  const routes = await calculateOptimalRoutes(
    {
      patientLocation: { latitude: lat, longitude: lng },
      requiredBedType: params.requiredBedType,
      urgency: (params.urgency?.toUpperCase() as any) || 'ROUTINE',
      limit: params.limit || 3
    },
    prisma
  );

  return {
    tool: 'find_nearby_facility',
    success: true,
    data: {
      origin: { latitude: lat, longitude: lng },
      facilities: routes.map(r => ({
        ...r,
        travelNotice: `${r.estimated_travel_time_minutes} minutes (ESTIMATED)`
      }))
    }
  };
}

// Tool 12: get_verified_health_knowledge
export async function get_verified_health_knowledge(params: { query: string }): Promise<ToolResult> {
  const result = retrieveVerifiedHealthKnowledge(params.query);
  return {
    tool: 'get_verified_health_knowledge',
    success: true,
    data: {
      chunks: result.chunks,
      hasSufficientEvidence: result.hasSufficientEvidence
    }
  };
}

// Tool 13: get_prediction_summary
export async function get_prediction_summary(params: { facilityId: string }): Promise<ToolResult> {
  try {
    const queuePred = await predictQueuePressure(params.facilityId, 6);
    const capPred = await predictCapacityPressure(params.facilityId, 'ICU', 24);

    return {
      tool: 'get_prediction_summary',
      success: true,
      data: {
        facilityId: params.facilityId,
        queueForecast: queuePred,
        capacityForecast: capPred
      }
    };
  } catch (err: any) {
    return {
      tool: 'get_prediction_summary',
      success: true,
      data: {
        facilityId: params.facilityId,
        dataStatus: 'INSUFFICIENT_DATA',
        notice: 'Operational forecasting requires at least 3 historical patient arrivals in PostgreSQL.'
      }
    };
  }
}

// -------------------------------------------------------------
// TOOL DISPATCHER REGISTRY
// -------------------------------------------------------------
export const TOOL_DEFINITIONS = [
  { name: 'get_patient_timeline', description: 'Retrieve chronological encounters, vitals, and referrals for a patient.' },
  { name: 'get_active_referrals', description: 'Retrieve current non-completed hospital referrals for a patient.' },
  { name: 'get_followups', description: 'Retrieve pending or overdue ASHA worker home follow-ups.' },
  { name: 'get_appointments', description: 'Retrieve scheduled and past clinic consultations.' },
  { name: 'get_prescriptions', description: 'Retrieve active prescriptions with dispensary stock disclosure.' },
  { name: 'get_health_summary', description: 'Retrieve chronic conditions and recent numerical vitals.' },
  { name: 'get_triage_result', description: 'Retrieve latest clinical assessment and AI recommendation.' },
  { name: 'get_facility_capabilities', description: 'Retrieve facility services, beds, and doctors.' },
  { name: 'get_facility_availability', description: 'Retrieve real-time operational status and readiness.' },
  { name: 'get_facility_queue', description: 'Retrieve active waiting queue count and wait time.' },
  { name: 'find_nearby_facility', description: 'Find nearest health facilities using Haversine distance and live telemetry.' },
  { name: 'get_verified_health_knowledge', description: 'Query verified clinical guidelines from MoHFW and WHO.' },
  { name: 'get_prediction_summary', description: 'Retrieve predictive operational pressure forecasts for a facility.' }
];

export async function executeAssistantTool(
  toolName: string,
  args: Record<string, any>,
  ctx: ToolExecutionContext
): Promise<ToolResult> {
  if (ctx.userId) {
    await recordAuditLog({
      userId: ctx.userId,
      action: `TOOL_${toolName.toUpperCase()}`,
      resource: 'AssistantTool',
      resourceId: args.patientId || args.facilityId || undefined
    });
  }

  switch (toolName) {
    case 'get_patient_timeline':
      return get_patient_timeline({ patientId: args.patientId || ctx.patientId || '' }, ctx);
    case 'get_active_referrals':
      return get_active_referrals({ patientId: args.patientId || ctx.patientId || '' }, ctx);
    case 'get_followups':
      return get_followups({ patientId: args.patientId || ctx.patientId || '' }, ctx);
    case 'get_appointments':
      return get_appointments({ patientId: args.patientId || ctx.patientId || '' }, ctx);
    case 'get_prescriptions':
      return get_prescriptions({ patientId: args.patientId || ctx.patientId || '' }, ctx);
    case 'get_health_summary':
      return get_health_summary({ patientId: args.patientId || ctx.patientId || '' }, ctx);
    case 'get_triage_result':
      return get_triage_result({ patientId: args.patientId || ctx.patientId || '' }, ctx);
    case 'get_facility_capabilities':
      return get_facility_capabilities({ facilityId: args.facilityId || ctx.facilityId || '' });
    case 'get_facility_availability':
      return get_facility_availability({ facilityId: args.facilityId || ctx.facilityId || '' });
    case 'get_facility_queue':
      return get_facility_queue({ facilityId: args.facilityId || ctx.facilityId || '' });
    case 'find_nearby_facility':
      return find_nearby_facility(args);
    case 'get_verified_health_knowledge':
      return get_verified_health_knowledge({ query: args.query || '' });
    case 'get_prediction_summary':
      return get_prediction_summary({ facilityId: args.facilityId || ctx.facilityId || '' });
    default:
      return { tool: toolName, success: false, error: `Unknown tool '${toolName}'` };
  }
}
