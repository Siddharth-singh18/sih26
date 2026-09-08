import { Router } from 'express';
import { login, getDoctors, getDoctorMe } from './auth.controller';
import { authenticate, requireDoctor } from '../../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/doctors', authenticate, getDoctors);
router.get('/doctor/me', authenticate, requireDoctor, getDoctorMe);

export default router;
