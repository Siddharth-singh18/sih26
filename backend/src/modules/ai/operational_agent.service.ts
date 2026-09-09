import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  broadcastFacilityAvailability,
  broadcastUrgentEscalation,
  getIO
} from '../../events/socket';
import { createNotification } from '../notifications/notification.service';
import { getDistrictOperationalPredictionsSummary } from '../prediction/prediction.service';

const prisma = new PrismaClient();

export interface AgentRecommendation {
  id: string;
  sourceEvent: string;
  sourceEntityId: string;
  facilityId: string;
  engineType: 'RULE_BASED_OPERATIONAL_ANALYZER';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context: {
    facilityName: string;
    facilityType: string;
    level: number;
    currentStatus: string;
    currentReadiness: number | null;
    icuAvailable: number;
    queueLoad: number;
    [key: string]: any;
  };
  recommendation: {
    actionType: 'UPDATE_FACILITY_AVAILABILITY' | 'ESCALATE_REFERRAL' | 'QUEUE_REBALANCING' | 'NOTIFY_CLINICAL_STAFF';
    targetEntity: string;
    proposedChanges: Record<string, any>;
    rationale: string;
  };
  confidence: number | null;
  requiresHumanApproval: boolean;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'EXECUTED';
  createdAt: string;
  humanDecision?: {
    decidedBy: string;
    decidedAt: string;
    outcome: 'APPROVED' | 'REJECTED' | 'MODIFIED';
    notes?: string;
    modifiedParams?: Record<string, any>;
  };
}

// In-memory active recommendation store with DB task backing
const activeRecommendations = new Map<string, AgentRecommendation>();

/**
 * Normalizes operational events, retrieves live PostgreSQL context,
 * and executes deterministic operational analysis.
 */
export async function analyzeOperationalEvent(
  sourceEvent: string,
  facilityId: string,
  sourceEntityId: string,
  eventData: Record<string, any> = {}
): Promise<AgentRecommendation | null> {
  // 1. Context Retrieval from PostgreSQL
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: {
      availability: true,
      capacities: true,
      doctors: { include: { doctor: true } }
    }
  });

  if (!facility) return null;

  // Retrieve active queue count
  const activeQueueCount = await prisma.queueEntry.count({
    where: {
      status: { in: ['WAITING', 'PRIORITY', 'IN_CONSULTATION'] },
      appointment: { facilityId }
    }
  });

  const icuCapacity = facility.capacities.find(c =>
    c.resource.toLowerCase().includes('icu')
  );
  const icuAvailable = icuCapacity ? Math.max(0, icuCapacity.total - icuCapacity.occupied) : 0;
  const currentStatus = facility.availability?.status || 'OPEN';
  const currentReadiness = facility.availability?.readinessScore ?? null;

  const operationalContext = {
    facilityName: facility.name,
    facilityType: facility.type,
    level: facility.level,
    currentStatus,
    currentReadiness,
    icuAvailable,
    queueLoad: activeQueueCount,
    eventData
  };

  // 2. Deterministic Rule-Based Classification (Part J & K)
  let recommendation: AgentRecommendation | null = null;

  // Case A: Critical ICU Exhaustion or Capacity Overload -> Recommend OVERCAPACITY
  const isCriticalCapacity =
    sourceEvent === 'CAPACITY_CRITICAL' ||
    eventData.trigger === 'ICU_EXHAUSTION' ||
    (icuCapacity && icuAvailable === 0);

  if (isCriticalCapacity) {
    const recId = `agent_rec_${crypto.randomUUID()}`;
    recommendation = {
      id: recId,
      sourceEvent,
      sourceEntityId,
      facilityId,
      engineType: 'RULE_BASED_OPERATIONAL_ANALYZER',
      riskLevel: 'CRITICAL',
      context: operationalContext,
      recommendation: {
        actionType: 'UPDATE_FACILITY_AVAILABILITY',
        targetEntity: `Facility:${facilityId}`,
        proposedChanges: {
          status: 'OVERCAPACITY',
          readinessScore: 40
        },
        rationale: `All ICU beds (${icuCapacity?.total ?? 0} total) are exhausted (0 available). Recommend transitioning availability to OVERCAPACITY to divert emergency transfers.`
      },
      confidence: 1.0, // Truthful: 100% deterministic rule match
      requiresHumanApproval: true, // Mandatory human approval gate
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString()
    };
  }
  // Case B: Severe Queue Congestion (> 10 waiting)
  else if (activeQueueCount > 10 && currentStatus === 'OPEN') {
    const recId = `agent_rec_${crypto.randomUUID()}`;
    recommendation = {
      id: recId,
      sourceEvent,
      sourceEntityId,
      facilityId,
      engineType: 'RULE_BASED_OPERATIONAL_ANALYZER',
      riskLevel: 'HIGH',
      context: operationalContext,
      recommendation: {
        actionType: 'QUEUE_REBALANCING',
        targetEntity: `Facility:${facilityId}`,
        proposedChanges: {
          alertCMO: true,
          queueLoad: activeQueueCount
        },
        rationale: `Active outpatient queue load (${activeQueueCount} waiting) exceeds normal capacity. Recommend notifying clinical director and triaging routine cases.`
      },
      confidence: 0.9,
      requiresHumanApproval: true,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString()
    };
  }
  // Case C: Urgent Referral Escalation Event
  else if (sourceEvent === 'URGENT_ESCALATION') {
    const recId = `agent_rec_${crypto.randomUUID()}`;
    recommendation = {
      id: recId,
      sourceEvent,
      sourceEntityId,
      facilityId,
      engineType: 'RULE_BASED_OPERATIONAL_ANALYZER',
      riskLevel: 'HIGH',
      context: operationalContext,
      recommendation: {
        actionType: 'NOTIFY_CLINICAL_STAFF',
        targetEntity: `Referral:${sourceEntityId}`,
        proposedChanges: {
          priority: 'URGENT',
          targetFacilityId: facilityId
        },
        rationale: `Incoming urgent clinical transfer (${eventData.urgency || 'URGENT'}) received for: ${eventData.reason || 'Critical care'}. Priority clinical intake advised.`
      },
      confidence: 1.0,
      requiresHumanApproval: true,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString()
    };
  }

  // 3. Store Recommendation & Create Database Audit Provenance
  if (recommendation) {
    activeRecommendations.set(recommendation.id, recommendation);

    // Create DB Task for operational visibility
    await prisma.task.create({
      data: {
        type: 'OPERATIONAL_ACTION',
        status: 'PENDING',
        priority: recommendation.riskLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        dueDate: new Date(Date.now() + 3600000) // 1 hour
      }
    }).catch(() => {});

    // Provenance AuditLog entry
    await prisma.auditLog.create({
      data: {
        action: 'AGENT_RECOMMENDATION_GENERATED',
        resource: 'OperationalIntelligenceAgent',
        resourceId: recommendation.id
      }
    }).catch(() => {});

    // Notify assigned facility doctors of pending operational recommendation
    for (const fd of facility.doctors) {
      if (fd.doctor?.userId) {
        await createNotification(
          fd.doctor.userId,
          'AGENT_RECOMMENDATION_PENDING',
          `Operational Intelligence Alert: ${recommendation.recommendation.rationale}`
        );
      }
    }
  }

  return recommendation;
}

/**
 * Human Approval Gate: Approves and executes an agent operational recommendation.
 */
export async function approveAgentRecommendation(
  recommendationId: string,
  userId: string,
  userRoles: string[] = []
): Promise<{ success: boolean; message: string; recommendation?: AgentRecommendation }> {
  const rec = activeRecommendations.get(recommendationId);
  if (!rec) {
    return { success: false, message: 'Recommendation not found or already processed' };
  }

  if (rec.status !== 'PENDING_APPROVAL') {
    return { success: false, message: `Recommendation is already ${rec.status}` };
  }

  // Authorize: User must be ADMIN or DOCTOR
  const isAuthorized = userRoles.includes('ADMIN') || userRoles.includes('DOCTOR');
  if (!isAuthorized) {
    return { success: false, message: 'Forbidden: Doctor or Administrator authorization required' };
  }

  // Execute the consequential action based on human approval
  if (rec.recommendation.actionType === 'UPDATE_FACILITY_AVAILABILITY') {
    const { status, readinessScore } = rec.recommendation.proposedChanges;

    await prisma.$transaction(async (tx) => {
      await tx.facilityAvailability.upsert({
        where: { facilityId: rec.facilityId },
        update: { status, readinessScore },
        create: { facilityId: rec.facilityId, status, readinessScore: readinessScore ?? 80 }
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'AGENT_ACTION_APPROVED',
          resource: 'FacilityAvailability',
          resourceId: rec.facilityId
        }
      });
    });

    // Emit live real-time event
    broadcastFacilityAvailability(rec.facilityId, {
      status,
      readinessScore,
      updatedAt: new Date().toISOString()
    });
  } else {
    // Record general approval in AuditLog
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'AGENT_ACTION_APPROVED',
        resource: 'OperationalIntelligenceAgent',
        resourceId: rec.id
      }
    });
  }

  rec.status = 'APPROVED';
  rec.humanDecision = {
    decidedBy: userId,
    decidedAt: new Date().toISOString(),
    outcome: 'APPROVED'
  };

  return { success: true, message: 'Agent recommendation successfully approved and executed', recommendation: rec };
}

/**
 * Human Approval Gate: Rejects an agent recommendation (no mutation executed).
 */
export async function rejectAgentRecommendation(
  recommendationId: string,
  userId: string,
  reason: string = 'Declined by human reviewer'
): Promise<{ success: boolean; message: string; recommendation?: AgentRecommendation }> {
  const rec = activeRecommendations.get(recommendationId);
  if (!rec) {
    return { success: false, message: 'Recommendation not found or already processed' };
  }

  if (rec.status !== 'PENDING_APPROVAL') {
    return { success: false, message: `Recommendation is already ${rec.status}` };
  }

  // Record rejection in AuditLog
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'AGENT_ACTION_REJECTED',
      resource: 'OperationalIntelligenceAgent',
      resourceId: rec.id
    }
  });

  rec.status = 'REJECTED';
  rec.humanDecision = {
    decidedBy: userId,
    decidedAt: new Date().toISOString(),
    outcome: 'REJECTED',
    notes: reason
  };

  return { success: true, message: 'Agent recommendation safely rejected. No changes made.', recommendation: rec };
}

/**
 * Human Approval Gate: Modifies and executes an agent recommendation with human parameters.
 */
export async function modifyAgentRecommendation(
  recommendationId: string,
  userId: string,
  modifications: Record<string, any>
): Promise<{ success: boolean; message: string; recommendation?: AgentRecommendation }> {
  const rec = activeRecommendations.get(recommendationId);
  if (!rec) {
    return { success: false, message: 'Recommendation not found or already processed' };
  }

  if (rec.status !== 'PENDING_APPROVAL') {
    return { success: false, message: `Recommendation is already ${rec.status}` };
  }

  // Apply modified parameters
  if (rec.recommendation.actionType === 'UPDATE_FACILITY_AVAILABILITY') {
    const finalStatus = modifications.status || rec.recommendation.proposedChanges.status;
    const finalReadiness = modifications.readinessScore !== undefined
      ? modifications.readinessScore
      : rec.recommendation.proposedChanges.readinessScore;

    await prisma.$transaction(async (tx) => {
      await tx.facilityAvailability.upsert({
        where: { facilityId: rec.facilityId },
        update: { status: finalStatus, readinessScore: finalReadiness },
        create: { facilityId: rec.facilityId, status: finalStatus, readinessScore: finalReadiness ?? 80 }
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'AGENT_ACTION_MODIFIED',
          resource: 'FacilityAvailability',
          resourceId: rec.facilityId
        }
      });
    });

    broadcastFacilityAvailability(rec.facilityId, {
      status: finalStatus,
      readinessScore: finalReadiness,
      updatedAt: new Date().toISOString()
    });
  }

  rec.status = 'MODIFIED';
  rec.humanDecision = {
    decidedBy: userId,
    decidedAt: new Date().toISOString(),
    outcome: 'MODIFIED',
    modifiedParams: modifications
  };

  return { success: true, message: 'Agent recommendation modified and executed', recommendation: rec };
}

/**
 * List active recommendations
 */
export function listAgentRecommendations(facilityId?: string): AgentRecommendation[] {
  const all = Array.from(activeRecommendations.values());
  if (facilityId) {
    return all.filter(r => r.facilityId === facilityId);
  }
  return all;
}

/**
 * Clear recommendations (for test harness isolation)
 */
export function clearAgentRecommendationsForTest(): void {
  activeRecommendations.clear();
}

// -------------------------------------------------------------
// PHASE 5: DETERMINISTIC OPERATIONAL INTELLIGENCE SUMMARIES
// -------------------------------------------------------------

export interface OperationalIntelligenceSummary {
  engineType: 'RULE_BASED_OPERATIONAL_ANALYZER';
  model?: string;
  generatedAt: string;
  generated_at?: string;
  districtStatus: 'CRITICAL' | 'STRAINED' | 'STABLE';
  prioritizedFacilities: {
    facilityId: string;
    facilityName: string;
    priorityRank: number;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    bottleneckSummary: string;
    keyMetrics: {
      availabilityStatus: string;
      icuAvailable: number;
      activeQueue: number;
      pendingUrgentReferrals: number;
    };
    recommendedAction: string;
  }[];
  corridorBottleneckSummary: string[];
}

export async function generateOperationalIntelligenceSummary(
  targetFacilityId?: string
): Promise<OperationalIntelligenceSummary> {
  // Query live DB
  const facilities = await prisma.facility.findMany({
    where: targetFacilityId ? { id: targetFacilityId } : {},
    include: {
      availability: true,
      capacities: true,
      referralsIn: {
        where: {
          status: { in: ['CREATED', 'SUBMITTED'] },
          urgency: 'URGENT'
        },
        select: { id: true }
      }
    }
  });

  const prioritizedFacilities: OperationalIntelligenceSummary['prioritizedFacilities'] = [];

  for (const f of facilities) {
    const activeQueue = await prisma.queueEntry.count({
      where: {
        status: { in: ['WAITING', 'PRIORITY', 'IN_CONSULTATION'] },
        appointment: { facilityId: f.id }
      }
    });

    const icuCap = f.capacities.find(c => c.resource.toUpperCase().includes('ICU'));
    const icuAvailable = icuCap ? Math.max(0, icuCap.total - icuCap.occupied) : 999;
    const currentStatus = f.availability?.status || 'OPEN';
    const pendingUrgent = f.referralsIn.length;

    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    const reasons: string[] = [];
    let recommendedAction = 'Maintain standard operational monitoring.';

    if (currentStatus === 'OVERCAPACITY' || (icuCap && icuAvailable === 0)) {
      severity = 'CRITICAL';
      if (icuCap && icuAvailable === 0) reasons.push(`ICU capacity is fully occupied (0 of ${icuCap.total} beds available)`);
      if (currentStatus === 'OVERCAPACITY') reasons.push('facility status flagged as OVERCAPACITY');
      recommendedAction = 'Divert high-acuity inbound transfers to tertiary network and evaluate secondary discharge readiness.';
    }

    if (activeQueue > 10) {
      if (severity !== 'CRITICAL') severity = 'HIGH';
      reasons.push(`outpatient queue load is elevated (${activeQueue} patients awaiting consultation)`);
      if (recommendedAction.startsWith('Maintain')) {
        recommendedAction = 'Assign additional medical officer to outpatient clinic to clear consultation backlog.';
      }
    }

    if (pendingUrgent > 0) {
      if (severity !== 'CRITICAL') severity = 'HIGH';
      reasons.push(`${pendingUrgent} urgent clinical transfers remain pending review`);
      if (!recommendedAction.includes('inbound transfers')) {
        recommendedAction = 'Prioritize triage and bed allocation for pending urgent referrals.';
      }
    }

    if (activeQueue >= 4 && activeQueue <= 10 && severity === 'LOW') {
      severity = 'MEDIUM';
      reasons.push(`outpatient queue is moderately active (${activeQueue} patients awaiting consultation)`);
    }

    if (reasons.length === 0) {
      reasons.push('all capacity, queue, and referral metrics operate within normal operational thresholds');
    }

    const summarySentence = `${f.name} shows ${severity.toLowerCase()} operational pressure because ${reasons.join(' and ')}.`;

    prioritizedFacilities.push({
      facilityId: f.id,
      facilityName: f.name,
      priorityRank: severity === 'CRITICAL' ? 1 : severity === 'HIGH' ? 2 : severity === 'MEDIUM' ? 3 : 4,
      severity,
      bottleneckSummary: summarySentence,
      keyMetrics: {
        availabilityStatus: currentStatus,
        icuAvailable: icuCap ? icuAvailable : -1,
        activeQueue,
        pendingUrgentReferrals: pendingUrgent
      },
      recommendedAction
    });
  }

  // Sort by priority rank ascending
  prioritizedFacilities.sort((a, b) => a.priorityRank - b.priorityRank);

  const hasCritical = prioritizedFacilities.some(f => f.severity === 'CRITICAL');
  const hasHigh = prioritizedFacilities.some(f => f.severity === 'HIGH');
  const districtStatus = hasCritical ? 'CRITICAL' : hasHigh ? 'STRAINED' : 'STABLE';

  // Real referral corridor bottleneck strings
  const corridors = await prisma.referral.findMany({
    where: { status: { in: ['CREATED', 'SUBMITTED'] } },
    include: { origin: { select: { name: true } }, destination: { select: { name: true } } }
  });

  const corridorCounts = new Map<string, { origin: string; dest: string; count: number; urgent: number }>();
  for (const r of corridors) {
    const key = `${r.origin.name} -> ${r.destination.name}`;
    if (!corridorCounts.has(key)) {
      corridorCounts.set(key, { origin: r.origin.name, dest: r.destination.name, count: 0, urgent: 0 });
    }
    const item = corridorCounts.get(key)!;
    item.count++;
    if (r.urgency === 'URGENT') item.urgent++;
  }

  const corridorBottleneckSummary: string[] = [];
  for (const [corridor, data] of corridorCounts.entries()) {
    if (data.count >= 2 || data.urgent >= 1) {
      corridorBottleneckSummary.push(
        `Transfer corridor ${corridor} has ${data.count} pending referrals (${data.urgent} urgent) awaiting destination acceptance.`
      );
    }
  }

  const nowIso = new Date().toISOString();
  return {
    engineType: 'RULE_BASED_OPERATIONAL_ANALYZER',
    model: 'RULE_BASED_OPERATIONAL_ANALYZER',
    generatedAt: nowIso,
    generated_at: nowIso,
    districtStatus,
    prioritizedFacilities,
    corridorBottleneckSummary
  };
}

/**
 * Phase 10: Controlled Operational Agent Predictive Interpretation
 * Ingests statistical predictions and synthesizes human-reviewed operational directives.
 * Zero numerical hallucination: Strictly contextualizes mathematically derived predictions.
 */
export async function generatePredictiveInterpretation(targetFacilityId?: string): Promise<{
  engineType: 'RULE_BASED_OPERATIONAL_ANALYZER';
  generatedAt: string;
  districtPosture: string;
  directives: Array<{
    targetEntity: string;
    facilityId?: string;
    urgency: 'ROUTINE' | 'PRIORITY' | 'URGENT';
    category: 'QUEUE' | 'CAPACITY' | 'REFERRAL' | 'COMMUNITY';
    interpretation: string;
    recommendedAction: string;
    requiresHumanReview: boolean;
    autonomousMutationAllowed: false;
  }>;
  unsupportedDomains: string[];
}> {
  const summary = await getDistrictOperationalPredictionsSummary();

  const directives: Array<{
    targetEntity: string;
    facilityId?: string;
    urgency: 'ROUTINE' | 'PRIORITY' | 'URGENT';
    category: 'QUEUE' | 'CAPACITY' | 'REFERRAL' | 'COMMUNITY';
    interpretation: string;
    recommendedAction: string;
    requiresHumanReview: boolean;
    autonomousMutationAllowed: false;
  }> = [];

  for (const f of summary.facilities) {
    if (targetFacilityId && f.facilityId !== targetFacilityId) continue;

    // Queue Pressure Directives
    if (f.queuePressure.dataStatus === 'VERIFIED_PREDICTABLE') {
      if (['CRITICAL', 'HIGH'].includes(f.queuePressure.pressureLevel)) {
        directives.push({
          targetEntity: f.facilityName,
          facilityId: f.facilityId,
          urgency: f.queuePressure.pressureLevel === 'CRITICAL' ? 'URGENT' : 'PRIORITY',
          category: 'QUEUE',
          interpretation: `Predicted queue of ${f.queuePressure.predictedQueue} patients within ${f.queuePressure.horizon} (${f.queuePressure.pressureLevel} pressure). Recent arrival velocity and ${f.queuePressure.scheduledAppointmentsInHorizon} scheduled arrivals exceed single-doctor throughput.`,
          recommendedAction: 'Verify doctor on-duty staffing. Prepare secondary consultation room or alert triage coordinator.',
          requiresHumanReview: true,
          autonomousMutationAllowed: false
        });
      }
    }

    // Capacity Pressure Directives
    for (const cap of f.capacityPressure) {
      if (cap.dataStatus === 'VERIFIED_PREDICTABLE' && ['CRITICAL', 'HIGH'].includes(cap.pressureLevel)) {
        directives.push({
          targetEntity: `${f.facilityName} (${cap.category})`,
          facilityId: f.facilityId,
          urgency: cap.pressureLevel === 'CRITICAL' ? 'URGENT' : 'PRIORITY',
          category: 'CAPACITY',
          interpretation: `${cap.category} bed occupancy is projected to reach ${cap.predictedUtilizationRate}% within ${cap.horizon} with ${cap.inboundUrgentReferrals} inbound urgent referrals.`,
          recommendedAction: 'Review pending step-down discharges and coordinate with regional sub-district hospitals for diversion readiness.',
          requiresHumanReview: true,
          autonomousMutationAllowed: false
        });
      }
    }
  }

  // Referral Delay Risk Directives
  if (summary.referralDelayRisk.dataStatus === 'VERIFIED_PREDICTABLE' && summary.referralDelayRisk.delayRiskLevel === 'HIGH') {
    directives.push({
      targetEntity: 'District Referral Corridor',
      urgency: 'URGENT',
      category: 'REFERRAL',
      interpretation: `Inter-facility referrals are experiencing high delay risk (historical median ${summary.referralDelayRisk.historicalMedianHours}h vs ${summary.referralDelayRisk.clinicalThresholdHours}h clinical limit; ${summary.referralDelayRisk.destinationBacklogCount} pending transfers in destination backlog).`,
      recommendedAction: 'Dispatch administrative notification to receiving facility specialists to expedite acceptance of high-acuity transfers.',
      requiresHumanReview: true,
      autonomousMutationAllowed: false
    });
  }

  // Follow-Up Overload Directives
  if (summary.followUpOverload.dataStatus === 'VERIFIED_PREDICTABLE' && summary.followUpOverload.overloadRiskLevel === 'HIGH') {
    directives.push({
      targetEntity: 'Frontline Community Health Workers',
      urgency: 'PRIORITY',
      category: 'COMMUNITY',
      interpretation: `Community care gap includes ${summary.followUpOverload.currentlyOverdue} overdue and ${summary.followUpOverload.imminentTasksDue} imminent home visits within ${summary.followUpOverload.horizon}.`,
      recommendedAction: 'Rebalance high-burden village clusters across auxiliary health workers and schedule targeted field support.',
      requiresHumanReview: true,
      autonomousMutationAllowed: false
    });
  }

  const hasUrgent = directives.some(d => d.urgency === 'URGENT');
  const hasPriority = directives.some(d => d.urgency === 'PRIORITY');
  const districtPosture = hasUrgent ? 'CRITICAL_RISK' : hasPriority ? 'ELEVATED_PRESSURE' : 'NOMINAL';

  return {
    engineType: 'RULE_BASED_OPERATIONAL_ANALYZER',
    generatedAt: new Date().toISOString(),
    districtPosture,
    directives,
    unsupportedDomains: [
      'diagnostic_demand_forecasting (NOT_SUPPORTED_BY_SCHEMA - missing facilityId & timestamps)',
      'medicine_stockout_risk (NOT_SUPPORTED_BY_SCHEMA - missing transaction ledger)'
    ]
  };
}


