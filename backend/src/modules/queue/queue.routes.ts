import { Router } from 'express';
import { enqueuePatient, getQueueForDoctor, updateQueueStatus, getAllQueue } from './queue.controller';
import { requirePermission } from '../../middleware/rbac';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// Require encounter.update permission to change consultation queue status
router.post('/', requirePermission('encounter.create'), enqueuePatient);
router.get('/', getAllQueue);
router.get('/doctor/:doctorId', getQueueForDoctor);
router.put('/:id/status', requirePermission('queue.manage'), updateQueueStatus);
router.patch('/:id/status', requirePermission('queue.manage'), updateQueueStatus);

export default router;
