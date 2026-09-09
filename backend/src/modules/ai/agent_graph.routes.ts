import { Router } from 'express';
import {
  handleRunAgentGraph,
  listGraphRecommendations,
  handleApproveGraphAction,
  handleRejectGraphAction
} from './agent_graph.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

// Run agent graph workflow
router.post('/run', handleRunAgentGraph);
router.post('/execute', handleRunAgentGraph);

// List pending graph recommendations
router.get('/recommendations', listGraphRecommendations);

// Approve high-impact recommendation (Doctor or Admin only)
router.post('/approve', requireRole('DOCTOR'), handleApproveGraphAction);
router.post('/recommendations/:id/approve', requireRole('DOCTOR'), handleApproveGraphAction);

// Reject recommendation (Doctor or Admin only)
router.post('/reject', requireRole('DOCTOR'), handleRejectGraphAction);
router.post('/recommendations/:id/reject', requireRole('DOCTOR'), handleRejectGraphAction);

export default router;
