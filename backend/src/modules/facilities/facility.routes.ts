import { Router } from 'express';
import { getFacilities, updateFacilityAvailability } from './facility.controller';
import { getFacilities, updateFacilityAvailability, updateFacilityCapacity } from './facility.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('facility.read'), getFacilities);
router.put('/:id/availability', requirePermission('facility.update'), updateFacilityAvailability);
router.put('/:id/capacity/:capacityId', requirePermission('facility.update'), updateFacilityCapacity);

export default router;

