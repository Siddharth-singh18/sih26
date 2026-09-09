import { Router } from 'express';
import { listDiagnostics, getDiagnosticById, createDiagnosticOrder } from './diagnostic.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', listDiagnostics);
router.get('/:id', getDiagnosticById);
router.post('/', requireRole('DOCTOR'), createDiagnosticOrder);
router.post('/orders', requireRole('DOCTOR'), createDiagnosticOrder);

export default router;

