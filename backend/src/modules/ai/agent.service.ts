import { prisma } from '../../index';

// 47. CONTROLLED AGENTIC AI (Human-in-the-loop enforced)
// Agents can propose complex workflow mutations (like mass-scheduling follow-ups),
// but the backend strictly enforces that they are saved as PENDING for human review.

export const generateAgenticWorkflow = async (contextData: any, aiOutput: any) => {
  try {
    const { actionType, targets, proposedSchedule } = aiOutput;
    
    // Safety check 1: Only allow known safe agentic actions
    const allowedActions = ['PROPOSE_MASS_FOLLOW_UP', 'SUGGEST_INVENTORY_RESTOCK'];
    if (!allowedActions.includes(actionType)) {
      throw new Error(`Agentic action ${actionType} is strictly prohibited by policy.`);
    }

    // Safety check 2: Never allow direct DB mutations. Save as a 'TaskProposal' (simulated here via a general log or specific entity)
    console.log('[Agentic AI] Agent proposed:', actionType, 'for targets:', targets);

    // If it's a follow-up campaign proposal (e.g. for Chronic Neglect patients)
    if (actionType === 'PROPOSE_MASS_FOLLOW_UP') {
      const generatedTasks = targets.map((patientId: string) => ({
        patientId,
        workerId: 'assigned-worker-id', // Would be dynamically resolved
        dueDate: new Date(proposedSchedule),
        reason: 'AI-Generated Chronic Care Campaign',
        status: 'PENDING_APPROVAL' // STRICT: Not active until human Admin clicks "Approve"
      }));

      // In a real schema, we'd have a CampaignTask model, reusing FollowUp for now with PENDING_APPROVAL
      await prisma.followUp.createMany({
        data: generatedTasks
      });

      return {
        status: 'PROPOSAL_CREATED',
        message: 'Agent workflow successfully staged for human review.',
        tasksGenerated: generatedTasks.length
      };
    }

  } catch (error) {
    console.error('Agentic Workflow Error:', error);
    throw error;
  }
};
