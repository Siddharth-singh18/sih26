import { Router } from 'express';
import { createAssessment, getAssessmentsByPatient, confirmTriageRecommendation } from './assessment.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('assessment.create'), createAssessment);
router.get('/', requirePermission('assessment.read'), getAssessmentsByPatient);
router.get('/patient/:patientId', requirePermission('assessment.read'), getAssessmentsByPatient);
router.patch('/:id/triage/confirm', requirePermission('assessment.create'), confirmTriageRecommendation);

export default router;
