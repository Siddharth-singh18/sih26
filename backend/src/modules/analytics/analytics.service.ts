import { prisma } from '../../index';

// 48. PREDICTIVE OPERATIONS
// This engine analyzes recent spikes in specific symptoms/diseases 
// to predict supply chain shortages before they happen.

// -------------------------------------------------------------
// CENTRALIZED DOMAIN THRESHOLDS (PART 3)
// -------------------------------------------------------------
export const REFERRAL_STUCK_THRESHOLDS_HOURS = {
  URGENT: 4,     // Critical/Urgent referrals must be accepted/scheduled within 4 hours
  PRIORITY: 24,  // Priority referrals must be processed within 24 hours
  ROUTINE: 72    // Routine referrals must be reviewed within 72 hours (3 business days)
} as const;

export type ReferralUrgency = keyof typeof REFERRAL_STUCK_THRESHOLDS_HOURS;

// Helper to normalize capacity category from resource string
export const normalizeResourceCategory = (resource: string): string => {
  const r = resource.toUpperCase();
  if (r.includes('ICU') || r.includes('HDU')) return 'ICU';
  if (r.includes('OXYGEN')) return 'OXYGEN';
  if (r.includes('MATERN') || r.includes('LABOR') || r.includes('DELIVERY')) return 'MATERNITY';
  if (r.includes('NICU') || r.includes('PICU')) return 'NICU';
  if (r.includes('GENERAL') || r.includes('OBSERVATION') || r.includes('WARD')) return 'GENERAL';
  return 'OTHER';
};

// -------------------------------------------------------------
// 1. FACILITY & CAPACITY OPERATIONAL METRICS (PHASE 1)
// -------------------------------------------------------------

export interface CapacityAggregate {
  total: number;
  occupied: number;
  available: number;
  utilizationRate: number; // percentage rounded to 2 decimals
}

export interface CategoryCapacityAggregate extends CapacityAggregate {
  category: string;
  facilityCount: number;
}

export interface FacilityOperationalSummary {
  totalFacilities: number;
  byType: Record<string, number>;
  byLevel: Record<number, number>;
  availabilityDistribution: {
    OPEN: number;
    OVERCAPACITY: number;
    CLOSED: number;
    unknown: number;
  };
  readinessStats: {
    average: number | null;
    min: number | null;
    max: number | null;
    count: number;
  };
  capacity: CapacityAggregate;
  capacityByCategory: Record<string, CategoryCapacityAggregate>;
  queue: {
    activeQueueCount: number;
    waiting: number;
    priority: number;
    inConsultation: number;
    completed: number;
  };
}

export async function getFacilityOperationalMetrics(): Promise<FacilityOperationalSummary> {
  const [facilities, capacities, availabilities, queueEntries] = await Promise.all([
    prisma.facility.findMany({ select: { id: true, type: true, level: true } }),
    prisma.facilityCapacity.findMany(),
    prisma.facilityAvailability.findMany(),
    prisma.queueEntry.findMany({ select: { status: true } })
  ]);

  // Total and distribution
  const byType: Record<string, number> = {};
  const byLevel: Record<number, number> = {};
  for (const f of facilities) {
    byType[f.type] = (byType[f.type] || 0) + 1;
    byLevel[f.level] = (byLevel[f.level] || 0) + 1;
  }

  // Availability distribution
  const availabilityDistribution = {
    OPEN: 0,
    OVERCAPACITY: 0,
    CLOSED: 0,
    unknown: 0
  };
  const readinessScores: number[] = [];
  for (const a of availabilities) {
    const status = a.status as 'OPEN' | 'OVERCAPACITY' | 'CLOSED';
    if (status in availabilityDistribution) {
      availabilityDistribution[status]++;
    } else {
      availabilityDistribution.unknown++;
    }
    if (a.readinessScore != null && !isNaN(a.readinessScore)) {
      readinessScores.push(a.readinessScore);
    }
  }

  const readinessStats = {
    average: readinessScores.length > 0
      ? Number((readinessScores.reduce((acc, v) => acc + v, 0) / readinessScores.length).toFixed(2))
      : null,
    min: readinessScores.length > 0 ? Math.min(...readinessScores) : null,
    max: readinessScores.length > 0 ? Math.max(...readinessScores) : null,
    count: readinessScores.length
  };

  // Capacities
  let grandTotal = 0;
  let grandOccupied = 0;
  const categoryMap = new Map<string, { total: number; occupied: number; facilities: Set<string> }>();

  for (const c of capacities) {
    grandTotal += c.total;
    grandOccupied += c.occupied;

    const cat = normalizeResourceCategory(c.resource);
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { total: 0, occupied: 0, facilities: new Set() });
    }
    const catEntry = categoryMap.get(cat)!;
    catEntry.total += c.total;
    catEntry.occupied += c.occupied;
    catEntry.facilities.add(c.facilityId);
  }

  const grandAvailable = Math.max(0, grandTotal - grandOccupied);
  const grandUtil = grandTotal > 0 ? Number(((grandOccupied / grandTotal) * 100).toFixed(2)) : 0;

  const capacityByCategory: Record<string, CategoryCapacityAggregate> = {};
  for (const [cat, data] of categoryMap.entries()) {
    const avail = Math.max(0, data.total - data.occupied);
    const util = data.total > 0 ? Number(((data.occupied / data.total) * 100).toFixed(2)) : 0;
    capacityByCategory[cat] = {
      category: cat,
      total: data.total,
      occupied: data.occupied,
      available: avail,
      utilizationRate: util,
      facilityCount: data.facilities.size
    };
  }

  // Queue aggregation (strictly separate active vs completed)
  let waiting = 0;
  let priority = 0;
  let inConsultation = 0;
  let completed = 0;

  for (const q of queueEntries) {
    if (q.status === 'WAITING') waiting++;
    else if (q.status === 'PRIORITY') priority++;
    else if (q.status === 'IN_CONSULTATION') inConsultation++;
    else if (q.status === 'COMPLETED') completed++;
  }

  const activeQueueCount = waiting + priority + inConsultation;

  return {
    totalFacilities: facilities.length,
    byType,
    byLevel,
    availabilityDistribution,
    readinessStats,
    capacity: {
      total: grandTotal,
      occupied: grandOccupied,
      available: grandAvailable,
      utilizationRate: grandUtil
    },
    capacityByCategory,
    queue: {
      activeQueueCount,
      waiting,
      priority,
      inConsultation,
      completed
    }
  };
}

// -------------------------------------------------------------
// 2. FACILITY PERFORMANCE INTELLIGENCE (PHASE 2)
// -------------------------------------------------------------

export interface FacilityPerformanceIndicator {
  facilityId: string;
  facilityName: string;
  facilityType: string;
  level: number;
  address: string | null;
  availability: {
    status: string;
    readinessScore: number | null;
    updatedAt: string | null;
  };
  capacity: {
    total: number;
    occupied: number;
    available: number;
    utilizationRate: number;
    categories: Record<string, { total: number; occupied: number; available: number; utilizationRate: number }>;
  };
  queue: {
    activeQueueCount: number;
    waiting: number;
    priority: number;
    inConsultation: number;
    completed: number;
  };
  appointments: {
    total: number;
    booked: number;
    inConsultation: number;
    completed: number;
    cancelled: number;
  };
  referrals: {
    originatingTotal: number;
    receivedTotal: number;
    pendingInbound: number;
    acceptedInbound: number;
    completedInbound: number;
  };
  diagnostics: {
    status: string;
    schemaNote: string;
  };
  followups: {
    totalAssigned: number;
    pending: number;
    completed: number;
    overdue: number;
  };
}

export async function getFacilityPerformanceIndicators(
  facilityId?: string
): Promise<FacilityPerformanceIndicator[]> {
  const whereFacility = facilityId ? { id: facilityId } : {};

  const facilities = await prisma.facility.findMany({
    where: whereFacility,
    include: {
      availability: true,
      capacities: true,
      workers: { select: { id: true } },
      appointments: {
        include: {
          queueEntry: true
        }
      },
      referralsIn: {
        select: { id: true, status: true, urgency: true }
      },
      referralsOut: {
        select: { id: true, status: true }
      }
    }
  });

  const indicators: FacilityPerformanceIndicator[] = [];

  for (const f of facilities) {
    // Capacity
    let totalCap = 0;
    let occCap = 0;
    const catMap: Record<string, { total: number; occupied: number; available: number; utilizationRate: number }> = {};

    for (const c of f.capacities) {
      totalCap += c.total;
      occCap += c.occupied;
      const cat = normalizeResourceCategory(c.resource);
      if (!catMap[cat]) {
        catMap[cat] = { total: 0, occupied: 0, available: 0, utilizationRate: 0 };
      }
      catMap[cat].total += c.total;
      catMap[cat].occupied += c.occupied;
    }

    for (const k of Object.keys(catMap)) {
      const avail = Math.max(0, catMap[k].total - catMap[k].occupied);
      const util = catMap[k].total > 0 ? Number(((catMap[k].occupied / catMap[k].total) * 100).toFixed(2)) : 0;
      catMap[k].available = avail;
      catMap[k].utilizationRate = util;
    }

    const availCap = Math.max(0, totalCap - occCap);
    const utilCap = totalCap > 0 ? Number(((occCap / totalCap) * 100).toFixed(2)) : 0;

    // Queue & Appointments from Appointments array
    let waiting = 0;
    let priority = 0;
    let inConsultationQueue = 0;
    let completedQueue = 0;

    let bookedAppts = 0;
    let inConsultationAppts = 0;
    let completedAppts = 0;
    let cancelledAppts = 0;

    for (const appt of f.appointments) {
      if (appt.status === 'BOOKED') bookedAppts++;
      else if (appt.status === 'IN_CONSULTATION') inConsultationAppts++;
      else if (appt.status === 'COMPLETED') completedAppts++;
      else if (appt.status === 'CANCELLED') cancelledAppts++;

      if (appt.queueEntry) {
        const qStatus = appt.queueEntry.status;
        if (qStatus === 'WAITING') waiting++;
        else if (qStatus === 'PRIORITY') priority++;
        else if (qStatus === 'IN_CONSULTATION') inConsultationQueue++;
        else if (qStatus === 'COMPLETED') completedQueue++;
      }
    }

    const activeQueue = waiting + priority + inConsultationQueue;

    // Referrals
    let pendingInbound = 0;
    let acceptedInbound = 0;
    let completedInbound = 0;
    for (const r of f.referralsIn) {
      if (['CREATED', 'SUBMITTED'].includes(r.status)) pendingInbound++;
      else if (r.status === 'ACCEPTED') acceptedInbound++;
      else if (r.status === 'COMPLETED' || r.status === 'COUNTER_REFERRED') completedInbound++;
    }

    // Follow-ups via worker assigned to facility
    const workerIds = f.workers.map(w => w.id);
    let followupsTotal = 0;
    let followupsPending = 0;
    let followupsCompleted = 0;
    let followupsOverdue = 0;

    if (workerIds.length > 0) {
      const now = new Date();
      const followups = await prisma.followUp.findMany({
        where: { workerId: { in: workerIds } },
        select: { status: true, dueDate: true }
      });
      followupsTotal = followups.length;
      for (const fu of followups) {
        if (fu.status === 'COMPLETED') {
          followupsCompleted++;
        } else if (fu.status === 'OVERDUE' || (fu.status === 'PENDING' && fu.dueDate < now)) {
          followupsOverdue++;
        } else if (fu.status === 'PENDING') {
          followupsPending++;
        }
      }
    }

    indicators.push({
      facilityId: f.id,
      facilityName: f.name,
      facilityType: f.type,
      level: f.level,
      address: f.address,
      availability: {
        status: f.availability?.status || 'UNKNOWN',
        readinessScore: f.availability?.readinessScore ?? null,
        updatedAt: f.availability?.updatedAt?.toISOString() ?? null
      },
      capacity: {
        total: totalCap,
        occupied: occCap,
        available: availCap,
        utilizationRate: utilCap,
        categories: catMap
      },
      queue: {
        activeQueueCount: activeQueue,
        waiting,
        priority,
        inConsultation: inConsultationQueue,
        completed: completedQueue
      },
      appointments: {
        total: f.appointments.length,
        booked: bookedAppts,
        inConsultation: inConsultationAppts,
        completed: completedAppts,
        cancelled: cancelledAppts
      },
      referrals: {
        originatingTotal: f.referralsOut.length,
        receivedTotal: f.referralsIn.length,
        pendingInbound,
        acceptedInbound,
        completedInbound
      },
      diagnostics: {
        status: 'NOT_SUPPORTED_BY_SCHEMA',
        schemaNote: 'DiagnosticOrder model lacks facilityId foreign key in Prisma schema. District-wide aggregation is supported.'
      },
      followups: {
        totalAssigned: followupsTotal,
        pending: followupsPending,
        completed: followupsCompleted,
        overdue: followupsOverdue
      }
    });
  }

  return indicators;
}

// -------------------------------------------------------------
// 3. REFERRAL BOTTLENECK INTELLIGENCE (PHASE 3)
// -------------------------------------------------------------

export interface ReferralCorridorBottleneck {
  corridorId: string;
  originFacilityId: string;
  originFacilityName: string;
  destinationFacilityId: string;
  destinationFacilityName: string;
  totalVolume: number;
  pendingCount: number;
  urgentPendingCount: number;
  acceptedCount: number;
  completedCount: number;
  isBottleneck: boolean;
  primaryDelayReason: string | null;
}

export interface StuckReferralDetail {
  referralId: string;
  originFacilityName: string;
  destinationFacilityName: string;
  urgency: string;
  status: string;
  submittedAt: string;
  elapsedHours: number;
  stuckThresholdHours: number;
  exceededByHours: number;
}

export interface ReferralBottleneckAnalytics {
  totalReferrals: number;
  byStatus: Record<string, number>;
  byUrgency: Record<string, number>;
  byOriginFacility: Record<string, { name: string; count: number }>;
  byDestinationFacility: Record<string, { name: string; count: number }>;
  processingTime: {
    measuredTransitionsCount: number;
    averageHours: number | null;
    medianHours: number | null;
  };
  stuckReferrals: {
    totalStuckCount: number;
    thresholds: typeof REFERRAL_STUCK_THRESHOLDS_HOURS;
    records: StuckReferralDetail[];
  };
  corridors: ReferralCorridorBottleneck[];
}

export async function getReferralBottleneckAnalytics(filters?: {
  originId?: string;
  destinationId?: string;
  urgency?: string;
}): Promise<ReferralBottleneckAnalytics> {
  const where: any = {};
  if (filters?.originId) where.originId = filters.originId;
  if (filters?.destinationId) where.destinationId = filters.destinationId;
  if (filters?.urgency) where.urgency = filters.urgency.toUpperCase();

  const referrals = await prisma.referral.findMany({
    where,
    include: {
      origin: { select: { id: true, name: true } },
      destination: { select: { id: true, name: true } },
      events: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  const byStatus: Record<string, number> = {};
  const byUrgency: Record<string, number> = {};
  const byOriginFacility: Record<string, { name: string; count: number }> = {};
  const byDestinationFacility: Record<string, { name: string; count: number }> = {};

  const corridorMap = new Map<string, {
    originId: string;
    originName: string;
    destId: string;
    destName: string;
    total: number;
    pending: number;
    urgentPending: number;
    accepted: number;
    completed: number;
  }>();

  const now = Date.now();
  const transitionDurationsHours: number[] = [];
  const stuckRecords: StuckReferralDetail[] = [];

  for (const r of referrals) {
    // Status counts
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    // Urgency counts
    byUrgency[r.urgency] = (byUrgency[r.urgency] || 0) + 1;

    // Origin/Dest
    if (!byOriginFacility[r.originId]) {
      byOriginFacility[r.originId] = { name: r.origin.name, count: 0 };
    }
    byOriginFacility[r.originId].count++;

    if (!byDestinationFacility[r.destinationId]) {
      byDestinationFacility[r.destinationId] = { name: r.destination.name, count: 0 };
    }
    byDestinationFacility[r.destinationId].count++;

    // Corridor
    const corridorKey = `${r.originId}->${r.destinationId}`;
    if (!corridorMap.has(corridorKey)) {
      corridorMap.set(corridorKey, {
        originId: r.originId,
        originName: r.origin.name,
        destId: r.destinationId,
        destName: r.destination.name,
        total: 0,
        pending: 0,
        urgentPending: 0,
        accepted: 0,
        completed: 0
      });
    }
    const c = corridorMap.get(corridorKey)!;
    c.total++;

    const isPending = ['CREATED', 'SUBMITTED'].includes(r.status);
    if (isPending) {
      c.pending++;
      if (r.urgency === 'URGENT') c.urgentPending++;
    } else if (r.status === 'ACCEPTED') {
      c.accepted++;
    } else if (['COMPLETED', 'COUNTER_REFERRED'].includes(r.status)) {
      c.completed++;
    }

    // Turnaround time: from SUBMITTED to ACCEPTED or COMPLETED in ReferralEvents
    const submittedEvent = r.events.find(e => e.statusTo === 'SUBMITTED');
    const acceptedEvent = r.events.find(e => e.statusTo === 'ACCEPTED');

    if (submittedEvent && acceptedEvent) {
      const diffMs = acceptedEvent.createdAt.getTime() - submittedEvent.createdAt.getTime();
      if (diffMs >= 0) {
        transitionDurationsHours.push(diffMs / (1000 * 60 * 60));
      }
    }

    // Stuck referrals calculation
    if (isPending && submittedEvent) {
      const elapsedHours = (now - submittedEvent.createdAt.getTime()) / (1000 * 60 * 60);
      const thresholdHours = REFERRAL_STUCK_THRESHOLDS_HOURS[r.urgency as ReferralUrgency] || 72;

      if (elapsedHours > thresholdHours) {
        stuckRecords.push({
          referralId: r.id,
          originFacilityName: r.origin.name,
          destinationFacilityName: r.destination.name,
          urgency: r.urgency,
          status: r.status,
          submittedAt: submittedEvent.createdAt.toISOString(),
          elapsedHours: Number(elapsedHours.toFixed(1)),
          stuckThresholdHours: thresholdHours,
          exceededByHours: Number((elapsedHours - thresholdHours).toFixed(1))
        });
      }
    }
  }

  // Turnaround metrics
  let averageHours: number | null = null;
  let medianHours: number | null = null;

  if (transitionDurationsHours.length > 0) {
    const sum = transitionDurationsHours.reduce((acc, v) => acc + v, 0);
    averageHours = Number((sum / transitionDurationsHours.length).toFixed(2));

    const sorted = [...transitionDurationsHours].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianHours = sorted.length % 2 === 0
      ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
      : Number(sorted[mid].toFixed(2));
  }

  // Corridors list
  const corridors: ReferralCorridorBottleneck[] = [];
  for (const [key, c] of corridorMap.entries()) {
    // Bottleneck domain rule: >= 3 pending OR >= 1 urgent pending
    const isBottleneck = c.pending >= 3 || c.urgentPending >= 1;
    let delayReason: string | null = null;
    if (isBottleneck) {
      if (c.urgentPending >= 1) {
        delayReason = `Critical delay: ${c.urgentPending} urgent referrals awaiting triage at destination`;
      } else {
        delayReason = `Referral volume accumulation: ${c.pending} transfers pending review`;
      }
    }

    corridors.push({
      corridorId: key,
      originFacilityId: c.originId,
      originFacilityName: c.originName,
      destinationFacilityId: c.destId,
      destinationFacilityName: c.destName,
      totalVolume: c.total,
      pendingCount: c.pending,
      urgentPendingCount: c.urgentPending,
      acceptedCount: c.accepted,
      completedCount: c.completed,
      isBottleneck,
      primaryDelayReason: delayReason
    });
  }

  // Sort corridors by pending count descending
  corridors.sort((a, b) => b.pendingCount - a.pendingCount || b.urgentPendingCount - a.urgentPendingCount);

  return {
    totalReferrals: referrals.length,
    byStatus,
    byUrgency,
    byOriginFacility,
    byDestinationFacility,
    processingTime: {
      measuredTransitionsCount: transitionDurationsHours.length,
      averageHours,
      medianHours
    },
    stuckReferrals: {
      totalStuckCount: stuckRecords.length,
      thresholds: REFERRAL_STUCK_THRESHOLDS_HOURS,
      records: stuckRecords.sort((a, b) => b.elapsedHours - a.elapsedHours)
    },
    corridors
  };
}

// -------------------------------------------------------------
// 4. DIAGNOSTIC OPERATIONS ANALYTICS (PHASE 4)
// -------------------------------------------------------------

export interface DiagnosticOperationsAnalytics {
  totalOrders: number;
  byStatus: {
    PENDING: number;
    COMPLETED: number;
    IN_PROGRESS: string; // schema limitation
    CANCELLED: string;   // schema limitation
  };
  demandByTestType: Record<string, number>;
  facilityWorkload: {
    status: string;
    schemaNote: string;
  };
}

export async function getDiagnosticOperationsAnalytics(): Promise<DiagnosticOperationsAnalytics> {
  const orders = await prisma.diagnosticOrder.findMany({
    select: {
      id: true,
      testName: true,
      status: true
    }
  });

  let pending = 0;
  let completed = 0;
  const demandByTestType: Record<string, number> = {};

  for (const o of orders) {
    if (o.status === 'PENDING') pending++;
    else if (o.status === 'COMPLETED') completed++;

    demandByTestType[o.testName] = (demandByTestType[o.testName] || 0) + 1;
  }

  return {
    totalOrders: orders.length,
    byStatus: {
      PENDING: pending,
      COMPLETED: completed,
      IN_PROGRESS: 'NOT_SUPPORTED_BY_SCHEMA',
      CANCELLED: 'NOT_SUPPORTED_BY_SCHEMA'
    },
    demandByTestType,
    facilityWorkload: {
      status: 'NOT_SUPPORTED_BY_SCHEMA',
      schemaNote: 'DiagnosticOrder model does not contain facilityId. Facility-scoped diagnostic analytics are NOT_SUPPORTED_BY_SCHEMA.'
    }
  };
}

// -------------------------------------------------------------
// 5. FOLLOW-UP / CARE BURDEN (PHASE 5)
// -------------------------------------------------------------

export interface FollowUpBurdenAnalytics {
  totalFollowUps: number;
  byStatus: {
    PENDING: number;
    COMPLETED: number;
    OVERDUE: number;
  };
  priorityBreakdown: {
    status: string;
    schemaNote: string;
  };
  workloadByWorker: Record<string, { workerId: string; workerType: string; facilityId: string | null; count: number }>;
  workloadByFacility: Record<string, number>;
}

export async function getFollowUpBurdenAnalytics(facilityId?: string): Promise<FollowUpBurdenAnalytics> {
  const now = new Date();

  // If facilityId specified, find workers assigned to that facility
  let workerFilter: any = {};
  if (facilityId) {
    const workers = await prisma.worker.findMany({
      where: { facilityId },
      select: { id: true }
    });
    workerFilter = { workerId: { in: workers.map(w => w.id) } };
  }

  const followups = await prisma.followUp.findMany({
    where: workerFilter,
    include: {
      worker: {
        select: { id: true, type: true, facilityId: true }
      }
    }
  });

  let pending = 0;
  let completed = 0;
  let overdue = 0;

  const workloadByWorker: Record<string, { workerId: string; workerType: string; facilityId: string | null; count: number }> = {};
  const workloadByFacility: Record<string, number> = {};

  for (const fu of followups) {
    if (fu.status === 'COMPLETED') {
      completed++;
    } else if (fu.status === 'OVERDUE' || (fu.status === 'PENDING' && fu.dueDate < now)) {
      overdue++;
    } else if (fu.status === 'PENDING') {
      pending++;
    }

    if (fu.worker) {
      const wId = fu.worker.id;
      if (!workloadByWorker[wId]) {
        workloadByWorker[wId] = {
          workerId: wId,
          workerType: fu.worker.type,
          facilityId: fu.worker.facilityId,
          count: 0
        };
      }
      workloadByWorker[wId].count++;

      if (fu.worker.facilityId) {
        workloadByFacility[fu.worker.facilityId] = (workloadByFacility[fu.worker.facilityId] || 0) + 1;
      }
    }
  }

  return {
    totalFollowUps: followups.length,
    byStatus: {
      PENDING: pending,
      COMPLETED: completed,
      OVERDUE: overdue
    },
    priorityBreakdown: {
      status: 'NOT_SUPPORTED_BY_SCHEMA',
      schemaNote: 'FollowUp model does not have priority or urgency fields in Prisma schema.'
    },
    workloadByWorker,
    workloadByFacility
  };
}

// -------------------------------------------------------------
// 6. DISTRICT-LEVEL OVERVIEW (PHASE 6)
// -------------------------------------------------------------

export interface DistrictOperationsOverview {
  districtName: string;
  timestamp: string;
  authorizationNote: {
    status: string;
    details: string;
  };
  facilities: FacilityOperationalSummary;
  referralBottlenecks: ReferralBottleneckAnalytics;
  diagnostics: DiagnosticOperationsAnalytics;
  followUps: FollowUpBurdenAnalytics;
}

export async function getDistrictOperationsOverview(): Promise<DistrictOperationsOverview> {
  const [facilities, referralBottlenecks, diagnostics, followUps] = await Promise.all([
    getFacilityOperationalMetrics(),
    getReferralBottleneckAnalytics(),
    getDiagnosticOperationsAnalytics(),
    getFollowUpBurdenAnalytics()
  ]);

  return {
    districtName: 'Pune District Healthcare Network',
    timestamp: new Date().toISOString(),
    authorizationNote: {
      status: 'ROLE_SCHEMA_LIMITATION',
      details: 'Dedicated DISTRICT_OFFICER or ADMIN role is NOT_SUPPORTED_BY_SCHEMA. District operational telemetry is surfaced to authorized Medical Officers and CMOs possessing facility.read permissions.'
    },
    facilities,
    referralBottlenecks,
    diagnostics,
    followUps
  };
}

// -------------------------------------------------------------
// LEGACY BACKWARD-COMPATIBLE SUPPLY CHAIN ENGINE (Cleaned of fake data)
// -------------------------------------------------------------
export const generateSupplyChainPredictions = async (facilityId: string) => {
  try {
    // Look at triage data for the last 7 days connected to this facility
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // In a real scenario, this would aggregate symptoms via Prisma's groupBy,
    // or run a time-series anomaly detection algorithm.
    const recentAssessments = await prisma.assessment.count({
      where: {
        encounter: { facilityId },
        createdAt: { gte: sevenDaysAgo },
        symptoms: {
          some: { name: { contains: 'Fever', mode: 'insensitive' } }
        }
      }
    });

    const predictions = [];

    // Simple heuristic threshold logic for the MVP
    if (recentAssessments > 50) {
      predictions.push({
        alertLevel: 'HIGH',
        category: 'Pharmacy',
        item: 'Paracetamol 500mg / Antibiotics',
        reason: `Detected an unusual spike (${recentAssessments} cases) in Fever-related triages over the last 7 days.`,
        recommendedAction: 'Increase restocking frequency by 2x for the next 14 days.'
      });
    }

    // Returning standard analytics + predictive alerts
    return {
      facilityId,
      timeframe: '7_DAYS',
      metrics: {
        feverCases: recentAssessments
      },
      predictions: [] // Zero mock predictions in Phase 5
    };

  } catch (error) {
    console.error('Analytics Engine Error:', error);
    return null;
  }
};

