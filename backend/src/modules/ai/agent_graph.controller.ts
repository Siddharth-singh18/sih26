import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import {
  runAgentGraph,
  approveAgentGraphAction,
  rejectAgentGraphAction,
  pendingAgentRecommendations,
  AgentIntent
} from './agent_graph.service';

export const handleRunAgentGraph = async (req: AuthRequest, res: Response) => {
  try {
    const rawIntent = req.body.intent || req.body.workflow;
    const intent = rawIntent as AgentIntent;
    const { patientId, facilityId, referralId } = req.body;

    const validIntents: AgentIntent[] = [
      'CARE_COORDINATION',
      'REFERRAL_CLOSURE',
      'FACILITY_OPERATIONS',
      'FOLLOWUP_GAP'
    ];

    if (!validIntents.includes(intent)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid agent intent. Must be one of: ${validIntents.join(', ')}`
      });
    }

    const state = await runAgentGraph({
      intent,
      userId: req.user?.id,
      role: req.user?.roles?.[0] || 'USER',
      patientId,
      facilityId,
      referralId
    });

    res.json(state);
  } catch (error: any) {
    console.error('Error running agent graph:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const listGraphRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const recommendations = Array.from(pendingAgentRecommendations.values());
    res.json({
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const handleApproveGraphAction = async (req: AuthRequest, res: Response) => {
  try {
    const actionId = req.params.id || req.body.id || req.body.graphRunId;
    const userId = req.user?.id || 'system';
    const roles = req.user?.roles || [];

    const result = await approveAgentGraphAction(actionId, userId, roles);
    if (!result.success) {
      const status = result.message.includes('Forbidden') ? 403 : 400;
      return res.status(status).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const handleRejectGraphAction = async (req: AuthRequest, res: Response) => {
  try {
    const actionId = req.params.id || req.body.id || req.body.graphRunId;
    const { reason, clinicianNotes } = req.body;
    const userId = req.user?.id || 'system';

    const result = await rejectAgentGraphAction(actionId, userId, reason || clinicianNotes || 'Rejected by clinician');
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
