import { Router } from 'express';
import { processSyncBatch, pullSyncChanges } from './sync.controller';
import { resolveSyncConflict } from './conflict.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

// Push batch mutations from offline queue (restricted to workers/doctors with encounter.create)
router.post('/', authenticate, requirePermission('encounter.create'), processSyncBatch);

// Delta sync: pull changes since a given timestamp
router.get('/pull', authenticate, pullSyncChanges);

// Resolve detected synchronization conflict
router.post('/conflict/resolve', authenticate, resolveSyncConflict);

export default router;
