import { Router } from 'express';
import { getDashboardMetrics } from './analytics.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// We can just use the authenticated session, no specific permission for general dashboard right now
router.get('/dashboard', getDashboardMetrics);

export default router;
