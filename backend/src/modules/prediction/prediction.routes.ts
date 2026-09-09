import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  getDataSufficiencyAudit,
  getOperationalPredictionsSummary,
  getFacilityPredictions,
  getQueuePressurePrediction,
  getCapacityPressurePrediction,
  getReferralDelayRiskPrediction,
  getDiagnosticWorkloadPrediction,
  getFollowUpOverloadPrediction,
  getModelEvaluation
} from './prediction.controller';

const router = Router();

// Allow authenticated requests
router.use(authenticate);

// Phase 0: Data sufficiency audit across all prediction targets
router.get('/audit', getDataSufficiencyAudit);

// Phase 1: District-wide operational prediction summary
router.get('/operations', getOperationalPredictionsSummary);

// Phase 2: Queue pressure prediction
router.get('/queue', getQueuePressurePrediction);

// Phase 3: Capacity pressure prediction by category
router.get('/capacity', getCapacityPressurePrediction);

// Phase 4: Referral delay risk prediction
router.get('/referrals', getReferralDelayRiskPrediction);

// Phase 5: Diagnostic demand notice (Schema limitation)
router.get('/diagnostics', getDiagnosticWorkloadPrediction);

// Phase 6: Follow-up workload / community care gap prediction
router.get('/followups', getFollowUpOverloadPrediction);

// Phase 8: Model evaluation & backtesting metrics
router.get('/evaluation', getModelEvaluation);

// Specific facility complete predictive profile
router.get('/facilities/:id', getFacilityPredictions);

export default router;
