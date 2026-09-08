import { Router } from 'express';
import {
  createPatient,
  searchPatients,
  getPatientTimeline,
  createEncounter,
  getMe,
  getMyTimeline,
  getMyHealthSummary,
  getMyAppointments,
  bookMyAppointment,
  cancelMyAppointment,
  getMyReferrals,
  getMyPrescriptions,
  getMyQueue,
  arriveMyAppointment,
  getMyFollowups
} from './patient.controller';
import { getAppointmentAvailability } from '../appointments/appointment.controller';
import { authenticate, requirePatient } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

// Apply auth middleware to all patient routes
router.use(authenticate);

// ─── Patient Self-Service Routes (Scoped to Authenticated Patient) ────────────
router.get('/me', requirePatient, getMe);
router.get('/me/timeline', requirePatient, getMyTimeline);
router.get('/me/health-summary', requirePatient, getMyHealthSummary);
router.get('/me/appointments', requirePatient, getMyAppointments);
router.get('/me/appointments/availability', requirePatient, getAppointmentAvailability);
router.post('/me/appointments', requirePatient, bookMyAppointment);
router.delete('/me/appointments/:id', requirePatient, cancelMyAppointment);
router.put('/me/appointments/:id/cancel', requirePatient, cancelMyAppointment);
router.post('/me/appointments/:id/arrive', requirePatient, arriveMyAppointment);
router.get('/me/referrals', requirePatient, getMyReferrals);
router.get('/me/prescriptions', requirePatient, getMyPrescriptions);
router.get('/me/queue', requirePatient, getMyQueue);
router.post('/me/queue/arrive', requirePatient, arriveMyAppointment);
router.get('/me/followups', requirePatient, getMyFollowups);

// ─── Clinical / Staff Routes ──────────────────────────────────────────────────
router.post('/', requirePermission('patient.create'), createPatient);
router.get('/search', requirePermission('patient.read'), searchPatients);
router.get('/:id/timeline', requirePermission('patient.read'), getPatientTimeline);

// Encounter routes
router.post('/encounter', requirePermission('encounter.create'), createEncounter);

export default router;
