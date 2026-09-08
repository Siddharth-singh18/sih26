import { Router } from 'express';
import { listDiagnostics, getDiagnosticById, createDiagnosticOrder } from './diagnostic.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', listDiagnostics);
router.get('/:id', getDiagnosticById);
router.post('/', createDiagnosticOrder);

export default router;

