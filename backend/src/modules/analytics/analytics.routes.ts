import { Router } from 'express';
import {
  getDashboardMetrics,
  getOperationsSummary,
  listFacilityAnalytics,
  getFacilityAnalyticsById,
  getReferralAnalytics,
  getDiagnosticAnalytics,
  getFollowUpAnalytics,
  getDistrictOverview
} from './analytics.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);

// 1. Dashboard summary (Cleaned of fake forecasts, backward-compatible)
router.get('/dashboard', getDashboardMetrics);

// 2. District & System Operations
router.get('/operations', requirePermission('facility.read'), getOperationsSummary);
router.get('/district', requirePermission('facility.read'), getDistrictOverview);

// 3. Facility Performance Analytics
router.get('/facilities', requirePermission('facility.read'), listFacilityAnalytics);
router.get('/facilities/:id', requirePermission('facility.read'), getFacilityAnalyticsById);

// 4. Referral Bottleneck Intelligence
router.get('/referrals', requirePermission('referral.read'), getReferralAnalytics);

// 5. Diagnostic Workload Analytics
router.get('/diagnostics', requirePermission('facility.read'), getDiagnosticAnalytics);

// 6. Community Follow-up Burden Analytics
router.get('/followups', requirePermission('task.read'), getFollowUpAnalytics);

export default router;
