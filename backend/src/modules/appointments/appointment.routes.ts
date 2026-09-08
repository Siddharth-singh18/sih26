import { Router } from 'express';
import { bookAppointment, getAllAppointments, getAppointmentAvailability } from './appointment.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/availability', getAppointmentAvailability);
router.post('/', bookAppointment);
router.get('/', getAllAppointments);

export default router;
