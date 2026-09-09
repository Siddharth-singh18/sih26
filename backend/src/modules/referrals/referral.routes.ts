import { Router } from 'express';
import { updateReferralStatus, createReferral, listReferrals, getReferralById } from './referral.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listReferrals);
router.get('/:id', getReferralById);
router.post('/', requirePermission('referral.create'), createReferral);
router.put('/:id/status', requirePermission('referral.update'), updateReferralStatus);

export default router;
