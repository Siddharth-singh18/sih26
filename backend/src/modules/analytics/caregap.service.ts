import { prisma } from '../../index';

// 45. CARE-GAP ENGINE
export const detectCareGaps = async () => {
  try {
    const gaps = [];

    // Gap 1: Follow-ups that are past their due date and not COMPLETED
    const missedFollowUps = await prisma.followUp.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: 'PENDING'
      },
      include: { worker: true }
    });

    if (missedFollowUps.length > 0) {
      gaps.push({
        type: 'MISSED_FOLLOW_UP',
        description: 'Patient missed critical follow-up after counter-referral',
        count: missedFollowUps.length,
        items: missedFollowUps
      });
    }

    // Gap 2: Patients with active chronic conditions but no assessments in the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const inactivePatients = await prisma.patient.findMany({
      where: {
        conditions: { some: { status: 'ACTIVE' } },
        encounters: {
          none: {
            start: { gte: sixMonthsAgo }
          }
        }
      }
    });

    if (inactivePatients.length > 0) {
      gaps.push({
        type: 'CHRONIC_NEGLECT',
        description: 'Patients with active conditions unassessed for > 6 months',
        count: inactivePatients.length,
        items: inactivePatients
      });
    }

    return gaps;

  } catch (error) {
    console.error('Care Gap Engine Error:', error);
    return [];
  }
};
