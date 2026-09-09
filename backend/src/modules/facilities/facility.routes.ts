import { Router } from 'express';
import { getFacilities, updateFacilityAvailability, updateFacilityCapacity, getFacilityRouting } from './facility.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('facility.read'), getFacilities);
router.post('/route', requirePermission('facility.read'), getFacilityRouting);
router.put('/:id/availability', requirePermission('facility.update'), updateFacilityAvailability);
router.patch('/:id/availability', requirePermission('facility.update'), updateFacilityAvailability);
router.put('/:id/capacity/:capacityId', requirePermission('facility.update'), updateFacilityCapacity);
router.patch('/:id/capacity/:capacityId', requirePermission('facility.update'), updateFacilityCapacity);

export default router;
