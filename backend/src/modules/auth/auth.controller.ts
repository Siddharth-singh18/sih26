import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../index';

export const login = async (req: Request, res: Response) => {
  try {
    let { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Bad Request', message: 'Phone and password are required' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 6 characters long' });
    }

    const cleanPhone = String(phone).trim().replace(/[\s-]/g, '');
    if (cleanPhone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ error: 'Bad Request', message: 'Please enter a valid 10-digit phone number' });
    }
    const phoneVariants = [cleanPhone];
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('+')) {
      phoneVariants.push('+91' + cleanPhone);
    } else if (cleanPhone.startsWith('+91')) {
      phoneVariants.push(cleanPhone.slice(3));
    } else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      phoneVariants.push('+' + cleanPhone);
      phoneVariants.push(cleanPhone.slice(2));
    }

    const user = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants } },
      include: { roles: true }
    });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const primaryRole = user.roles.length > 0 ? user.roles[0].name : 'USER';

    let displayName: string | undefined = undefined;
    let patientId: string | undefined = undefined;
    let doctorId: string | undefined = undefined;
    let workerId: string | undefined = undefined;

    if (primaryRole === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: user.id },
        include: { specialist: true }
      });
      if (doctor) {
        doctorId = doctor.id;
        const namePart = user.email ? user.email.split('@')[0].replace(/\./g, ' ') : doctor.id.replace(/^doc-/, '').replace(/-/g, ' ');
        const formatted = namePart.replace(/\b\w/g, (c) => c.toUpperCase());
        displayName = formatted.startsWith('Dr') ? formatted : `Dr. ${formatted}`;
      } else {
        displayName = 'Doctor';
      }
    } else if (primaryRole === 'WORKER') {
      const worker = await prisma.worker.findUnique({
        where: { userId: user.id }
      });
      if (worker) {
        workerId = worker.id;
        const namePart = user.email ? user.email.split('@')[0].replace(/\./g, ' ') : worker.id.replace(/^worker-/, '').replace(/-/g, ' ');
        displayName = namePart.replace(/\b\w/g, (c) => c.toUpperCase());
      } else {
        displayName = 'Health Worker';
      }
    } else if (primaryRole === 'PATIENT') {
      const patient = await prisma.patient.findFirst({
        where: { phone: { in: phoneVariants } },
        orderBy: { createdAt: 'asc' }
      });
      if (patient) {
        patientId = patient.id;
        displayName = patient.name;
      } else {
        displayName = 'Patient';
      }
    }

    const token = jwt.sign(
      { id: user.id, role: primaryRole, phone: user.phone, patientId, doctorId, workerId },
      process.env.JWT_SECRET || 'ayusync_super_secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        phone: user.phone,
        role: primaryRole,
        name: displayName,
        patientId,
        doctorId,
        workerId
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

import { AuthRequest } from '../../middleware/auth';

let cachedDoctors: any = null;
let doctorsCacheTimestamp = 0;
const DOCTORS_CACHE_TTL_MS = 60000; // 60 seconds

export const getDoctors = async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cachedDoctors && now - doctorsCacheTimestamp < DOCTORS_CACHE_TTL_MS) {
      return res.json(cachedDoctors);
    }

    const doctors = await prisma.doctor.findMany({
      include: {
        user: { select: { id: true, phone: true, email: true } },
        specialist: true,
        facilities: {
          include: {
            facility: {
              select: { id: true, name: true, type: true, level: true }
            }
          }
        }
      }
    });

    cachedDoctors = doctors;
    doctorsCacheTimestamp = now;

    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getDoctorMe = async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = req.user?.doctorId;
    if (!doctorId) {
      return res.status(404).json({ error: 'Not Found', message: 'No doctor profile linked to this account' });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: { select: { id: true, email: true, phone: true } },
        specialist: true,
        facilities: {
          include: { facility: true }
        }
      }
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Not Found', message: 'Doctor record not found' });
    }

    const namePart = doctor.user.email ? doctor.user.email.split('@')[0].replace(/\./g, ' ') : doctor.id.replace(/^doc-/, '').replace(/-/g, ' ');
    const formatted = namePart.replace(/\b\w/g, (c) => c.toUpperCase());
    const displayName = formatted.startsWith('Dr') ? formatted : `Dr. ${formatted}`;

    const facilityIds = doctor.facilities.map(f => f.facilityId);

    const [activeQueueCount, pendingReferralCount] = await Promise.all([
      prisma.queueEntry.count({
        where: {
          doctorId: doctor.id,
          status: { in: ['WAITING', 'PRIORITY', 'IN_CONSULTATION'] }
        }
      }),
      prisma.referral.count({
        where: {
          destinationId: { in: facilityIds },
          status: { in: ['SUBMITTED', 'ACCEPTED'] }
        }
      })
    ]);

    res.json({
      id: doctor.id,
      userId: doctor.userId,
      name: displayName,
      email: doctor.user.email,
      phone: doctor.user.phone,
      specialty: doctor.specialist?.specialty || 'General Medicine',
      facilities: doctor.facilities.map(f => ({
        id: f.facility.id,
        name: f.facility.name,
        type: f.facility.type,
        level: f.facility.level
      })),
      metrics: {
        activeQueueCount,
        pendingReferralCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

