import { Router } from 'express';
import {
  handleTriage,
  handleRoute,
  getAgentRecommendations,
  handleApproveAgentAction,
  handleRejectAgentAction,
  handleModifyAgentAction,
  triggerOperationalAgentAnalysis,
  getAgentOperationalSummary,
  getAgentPredictiveInterpretation
} from './ai.controller';
import { handleEmergencyEscalation } from './emergency.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole, requireAnyRole } from '../../middleware/rbac';

const router = Router();

// Allow authenticated requests or fallback for demo
router.use(authenticate);

router.post('/triage', handleTriage);
router.post('/route', handleRoute);
router.post('/emergency-escalate', requireAnyRole(['WORKER', 'DOCTOR']), handleEmergencyEscalation);

// Controlled Operational Agent Endpoints (Part J & K, Phase 5, Phase 6)
router.get('/agent/recommendations', getAgentRecommendations);
router.post('/agent/recommendations/:id/approve', requireRole('DOCTOR'), handleApproveAgentAction);
router.post('/agent/recommendations/:id/reject', requireRole('DOCTOR'), handleRejectAgentAction);
router.post('/agent/recommendations/:id/modify', requireRole('DOCTOR'), handleModifyAgentAction);
router.post('/agent/analyze', requireRole('DOCTOR'), triggerOperationalAgentAnalysis);
router.get('/agent/operational-summary', getAgentOperationalSummary);
router.get('/agent/predictive-interpretation', getAgentPredictiveInterpretation);

export default router;
