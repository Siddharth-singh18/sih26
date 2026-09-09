import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'ayusync_super_secret';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    roles: string[];
    permissions: string[];
    patientId?: string;
    workerId?: string;
    doctorId?: string;
    phone?: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        roles: {
          include: {
            permissions: true
          }
        },
        worker: true,
        doctor: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User inactive or not found' });
    }

    const roles = user.roles.map((r: any) => r.name);
    const permissions = Array.from(new Set(user.roles.flatMap((r: any) => r.permissions.map((p: any) => p.action)))) as string[];

    let patientId: string | undefined = decoded.patientId || undefined;
    if (!patientId && user.phone) {
      const cleanPhone = user.phone.trim().replace(/[\s-]/g, '');
      const phoneVariants = [cleanPhone];
      if (cleanPhone.length === 10 && !cleanPhone.startsWith('+')) {
        phoneVariants.push('+91' + cleanPhone);
      } else if (cleanPhone.startsWith('+91')) {
        phoneVariants.push(cleanPhone.slice(3));
      } else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        phoneVariants.push('+' + cleanPhone);
        phoneVariants.push(cleanPhone.slice(2));
      }

      const linkedPatient = await prisma.patient.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      });
      if (linkedPatient) {
        patientId = linkedPatient.id;
      }
    }

    const workerId = user.worker?.id || decoded.workerId || undefined;
    const doctorId = user.doctor?.id || decoded.doctorId || undefined;

    req.user = {
      id: user.id,
      roles,
      permissions,
      patientId,
      workerId,
      doctorId,
      phone: user.phone || undefined
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
};

export const requirePatient = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
  }
  if (!req.user.patientId) {
    return res.status(403).json({ error: 'Forbidden', message: 'No patient record linked to this account' });
  }
  next();
};

export const requireWorker = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
  }
  if (!req.user.roles.includes('WORKER') && !req.user.roles.includes('ADMIN')) {
    return res.status(403).json({ error: 'Forbidden', message: 'Frontline health worker access required' });
  }
  next();
};

export const requireDoctor = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
  }
  if (!req.user.roles.includes('DOCTOR') && !req.user.roles.includes('ADMIN')) {
    return res.status(403).json({ error: 'Forbidden', message: 'Doctor or medical officer access required' });
  }
  next();
};
