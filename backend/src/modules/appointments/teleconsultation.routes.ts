import { Router } from 'express';
import {
  requestTeleconsultation,
  listTeleconsultations,
  updateTeleconsultationStatus
} from './teleconsultation.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

// Request teleconsultation (ASHA worker, doctor, patient)
router.post('/request', requestTeleconsultation);

// List teleconsultations
router.get('/', listTeleconsultations);

// Update status (Doctor conducts teleconsultation)
router.put('/:id/status', requireRole('DOCTOR'), updateTeleconsultationStatus);
router.patch('/:id/status', requireRole('DOCTOR'), updateTeleconsultationStatus);

export default router;
