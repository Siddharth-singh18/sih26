import { Router } from 'express';
import { updateReferralStatus, createReferral, listReferrals, getReferralById } from './referral.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listReferrals);
router.get('/:id', getReferralById);
router.post('/', createReferral);
router.put('/:id/status', updateReferralStatus);

export default router;
