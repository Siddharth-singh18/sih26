import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { invalidatePredictionCache } from '../modules/prediction/prediction_cache';

const prisma = new PrismaClient();

let io: Server;
const JWT_SECRET = process.env.JWT_SECRET || 'ayusync_super_secret';

/**
 * Authenticates a JWT token and resolves user identity and roles from PostgreSQL
 */
async function authenticateSocketToken(token: string) {
  try {
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    if (!cleanToken) return null;
    const decoded = jwt.verify(cleanToken, JWT_SECRET) as any;
    if (!decoded || !decoded.id) return null;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        roles: true,
        worker: true,
        doctor: true
      }
    });

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      roles: user.roles.map((r: any) => r.name),
      doctorId: user.doctor?.id || decoded.doctorId || null,
      workerId: user.worker?.id || decoded.workerId || null,
      patientId: decoded.patientId || null
    };
  } catch {
    return null;
  }
}

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket Connection Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (typeof rawToken === 'string' && rawToken.trim()) {
        const authUser = await authenticateSocketToken(rawToken);
        if (authUser) {
          socket.data.user = authUser;
        } else if (socket.handshake.auth?.strictAuth) {
          return next(new Error('Authentication failed: Invalid token'));
        }
      } else if (socket.handshake.auth?.strictAuth) {
        return next(new Error('Authentication failed: Token required'));
      }
      return next();
    } catch (err: any) {
      return next(new Error(`Socket authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket: Socket) => {
    // Automatically join authenticated user's private rooms
    if (socket.data.user) {
      socket.join(`user_${socket.data.user.id}`);
      if (socket.data.user.workerId) {
        socket.join(`worker_${socket.data.user.workerId}`);
      }
      if (socket.data.user.doctorId) {
        socket.join(`doctor_${socket.data.user.doctorId}`);
      }
      if (socket.data.user.patientId) {
        socket.join(`patient_${socket.data.user.patientId}`);
      }
    }

    // 1. Authorized Doctor Room
    socket.on('join:doctor', (doctorId: string, callback?: (res: any) => void) => {
      const user = socket.data.user;
      if (!user) {
        const err = { success: false, error: 'Unauthorized: Authentication required' };
        socket.emit('error', { code: 'UNAUTHORIZED', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      const isAuthorized = user.roles.includes('ADMIN') || user.doctorId === doctorId;
      if (!isAuthorized) {
        const err = { success: false, error: 'Forbidden: Cannot access doctor room' };
        socket.emit('error', { code: 'FORBIDDEN', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      socket.join(`doctor_${doctorId}`);
      if (typeof callback === 'function') callback({ success: true, room: `doctor_${doctorId}` });
    });

    // 2. Authorized Facility Room (Part C - Facility Room Security)
    socket.on('join:facility', async (facilityId: string, callback?: (res: any) => void) => {
      const user = socket.data.user;
      if (!user) {
        const err = { success: false, error: 'Unauthorized: Authentication required' };
        socket.emit('error', { code: 'UNAUTHORIZED', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      if (!facilityId || typeof facilityId !== 'string') {
        const err = { success: false, error: 'Bad Request: Facility ID is required' };
        socket.emit('error', { code: 'BAD_REQUEST', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      // Check facility exists in DB
      const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
      if (!facility) {
        const err = { success: false, error: 'Not Found: Facility does not exist' };
        socket.emit('error', { code: 'FACILITY_NOT_FOUND', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      // Authorization Check based on authentic domain relationships
      // A. Superuser / Administrator
      if (user.roles.includes('ADMIN')) {
        socket.join(`facility_${facilityId}`);
        if (typeof callback === 'function') callback({ success: true, room: `facility_${facilityId}` });
        return;
      }

      // B. Doctor assigned to facility in FacilityDoctor
      if (user.doctorId) {
        const assignment = await prisma.facilityDoctor.findUnique({
          where: {
            facilityId_doctorId: {
              facilityId,
              doctorId: user.doctorId
            }
          }
        });
        if (assignment) {
          socket.join(`facility_${facilityId}`);
          if (typeof callback === 'function') callback({ success: true, room: `facility_${facilityId}` });
          return;
        }
      }

      // C. Worker assigned to facility
      if (user.workerId) {
        const worker = await prisma.worker.findFirst({
          where: {
            id: user.workerId,
            facilityId
          }
        });
        if (worker) {
          socket.join(`facility_${facilityId}`);
          if (typeof callback === 'function') callback({ success: true, room: `facility_${facilityId}` });
          return;
        }
      }

      // Unauthorized: Reject safely without leaking data
      const err = { success: false, error: 'Forbidden: You are not assigned to this facility' };
      socket.emit('error', { code: 'FORBIDDEN', message: err.error });
      if (typeof callback === 'function') callback(err);
    });

    // 3. Authorized Worker Room
    socket.on('join:worker', (workerId: string, callback?: (res: any) => void) => {
      const user = socket.data.user;
      if (!user) {
        const err = { success: false, error: 'Unauthorized: Authentication required' };
        socket.emit('error', { code: 'UNAUTHORIZED', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      const isAuthorized = user.roles.includes('ADMIN') || user.workerId === workerId;
      if (!isAuthorized) {
        const err = { success: false, error: 'Forbidden: Cannot access worker room' };
        socket.emit('error', { code: 'FORBIDDEN', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      socket.join(`worker_${workerId}`);
      if (typeof callback === 'function') callback({ success: true, room: `worker_${workerId}` });
    });

    // 4. Authorized Patient Room
    socket.on('join:patient', (patientId: string, callback?: (res: any) => void) => {
      const user = socket.data.user;
      if (!user) {
        const err = { success: false, error: 'Unauthorized: Authentication required' };
        socket.emit('error', { code: 'UNAUTHORIZED', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      const isAuthorized =
        user.roles.includes('ADMIN') ||
        user.patientId === patientId ||
        user.doctorId != null ||
        user.workerId != null;

      if (!isAuthorized) {
        const err = { success: false, error: 'Forbidden: Cannot access patient room' };
        socket.emit('error', { code: 'FORBIDDEN', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      socket.join(`patient_${patientId}`);
      if (typeof callback === 'function') callback({ success: true, room: `patient_${patientId}` });
    });

    // 5. Authorized User Personal Room (for Notifications)
    socket.on('join:user', (userId: string, callback?: (res: any) => void) => {
      const user = socket.data.user;
      if (!user) {
        const err = { success: false, error: 'Unauthorized: Authentication required' };
        socket.emit('error', { code: 'UNAUTHORIZED', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      const isAuthorized = user.roles.includes('ADMIN') || user.id === userId;
      if (!isAuthorized) {
        const err = { success: false, error: 'Forbidden: Cannot access user room' };
        socket.emit('error', { code: 'FORBIDDEN', message: err.error });
        if (typeof callback === 'function') callback(err);
        return;
      }

      socket.join(`user_${userId}`);
      if (typeof callback === 'function') callback({ success: true, room: `user_${userId}` });
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// -------------------------------------------------------------
// OPERATIONAL REALTIME BROADCAST HELPERS (PART B & D)
// -------------------------------------------------------------

// 1. FACILITY_AVAILABILITY_CHANGED
export const broadcastFacilityAvailability = (
  facilityId: string,
  data: {
    status: string;
    readinessScore?: number | null;
    updatedAt?: Date | string;
    entityId?: string;
  }
) => {
  const payload = {
    event: 'FACILITY_AVAILABILITY_CHANGED',
    facilityId,
    timestamp: new Date().toISOString(),
    entityId: data.entityId || facilityId,
    summary: `Facility availability changed to ${data.status}${
      data.readinessScore != null ? ` (Readiness: ${data.readinessScore})` : ''
    }`,
    data: {
      facilityId,
      status: data.status,
      readinessScore: data.readinessScore ?? null,
      updatedAt: data.updatedAt || new Date().toISOString()
    }
  };
  try {
    invalidatePredictionCache('FACILITY_AVAILABILITY_CHANGED', facilityId);
    getIO().to(`facility_${facilityId}`).emit('FACILITY_AVAILABILITY_CHANGED', payload);
    getIO().to(`facility_${facilityId}`).emit('facility.updated', payload);
  } catch {
    // Non-blocking
  }
  return payload;
};

// 2. FACILITY_CAPACITY_CHANGED
export const broadcastFacilityCapacity = (
  facilityId: string,
  data: {
    capacityId: string;
    category: string;
    total: number;
    occupied: number;
    available: number;
    updatedAt?: Date | string;
  }
) => {
  const payload = {
    event: 'FACILITY_CAPACITY_CHANGED',
    facilityId,
    timestamp: new Date().toISOString(),
    entityId: data.capacityId,
    summary: `${data.category} capacity updated: ${data.occupied}/${data.total} occupied (${data.available} available)`,
    data: {
      facilityId,
      capacityId: data.capacityId,
      category: data.category,
      total: data.total,
      occupied: data.occupied,
      available: data.available,
      updatedAt: data.updatedAt || new Date().toISOString()
    }
  };
  try {
    invalidatePredictionCache('FACILITY_CAPACITY_CHANGED', facilityId);
    getIO().to(`facility_${facilityId}`).emit('FACILITY_CAPACITY_CHANGED', payload);
    getIO().to(`facility_${facilityId}`).emit('capacity.updated', payload);
  } catch {
    // Non-blocking
  }
  return payload;
};

// 3. QUEUE_LOAD_CHANGED
export const broadcastQueueLoad = (
  facilityId: string,
  data: {
    activeQueueCount: number;
    entryId?: string;
    doctorId?: string | null;
    patientId?: string | null;
    action?: string;
    status?: string;
  }
) => {
  const payload = {
    event: 'QUEUE_LOAD_CHANGED',
    facilityId,
    timestamp: new Date().toISOString(),
    entityId: data.entryId || facilityId,
    summary: `Active queue load updated: ${data.activeQueueCount} patients awaiting care`,
    data: {
      facilityId,
      activeQueueCount: data.activeQueueCount,
      queueLoad: data.activeQueueCount,
      lastAction: data.action || 'UPDATE',
      entryId: data.entryId || null,
      status: data.status || null
    }
  };
  try {
    invalidatePredictionCache('QUEUE_LOAD_CHANGED', facilityId);
    getIO().to(`facility_${facilityId}`).emit('QUEUE_LOAD_CHANGED', payload);
    if (data.doctorId) {
      getIO().to(`doctor_${data.doctorId}`).emit('QUEUE_LOAD_CHANGED', payload);
    }
  } catch {
    // Non-blocking
  }
  return payload;
};

// 4. REFERRAL_OPERATIONAL_UPDATE
export const broadcastReferralOperational = (
  originId: string,
  destinationId: string,
  data: {
    referralId: string;
    status: string;
    urgency: string;
    reason?: string;
  }
) => {
  const payload = {
    event: 'REFERRAL_OPERATIONAL_UPDATE',
    facilityId: destinationId,
    timestamp: new Date().toISOString(),
    entityId: data.referralId,
    summary: `Referral ${data.referralId} status transitioned to ${data.status}`,
    data: {
      referralId: data.referralId,
      originId,
      destinationId,
      status: data.status,
      urgency: data.urgency,
      reason: data.reason || null
    }
  };
  try {
    invalidatePredictionCache('REFERRAL_OPERATIONAL_UPDATE', destinationId);
    invalidatePredictionCache('REFERRAL_OPERATIONAL_UPDATE', originId);
    getIO().to(`facility_${originId}`).emit('REFERRAL_OPERATIONAL_UPDATE', payload);
    getIO().to(`facility_${destinationId}`).emit('REFERRAL_OPERATIONAL_UPDATE', payload);
  } catch {
    // Non-blocking
  }
  return payload;
};

// 5. URGENT_ESCALATION
export const broadcastUrgentEscalation = (
  facilityId: string,
  data: {
    escalationType: string;
    entityId: string;
    urgency: string;
    reason: string;
    summary?: string;
  }
) => {
  const payload = {
    event: 'URGENT_ESCALATION',
    facilityId,
    timestamp: new Date().toISOString(),
    entityId: data.entityId,
    summary: data.summary || `Urgent clinical escalation: ${data.urgency} - ${data.reason}`,
    data: {
      escalationType: data.escalationType,
      facilityId,
      entityId: data.entityId,
      urgency: data.urgency,
      reason: data.reason
    }
  };
  try {
    invalidatePredictionCache('URGENT_ESCALATION', facilityId);
    getIO().to(`facility_${facilityId}`).emit('URGENT_ESCALATION', payload);
  } catch {
    // Non-blocking
  }
  return payload;
};

// -------------------------------------------------------------
// LEGACY BACKWARD-COMPATIBLE BROADCAST HELPERS
// -------------------------------------------------------------

export const broadcastTriageUpdate = (doctorId: string, payload: any) => {
  try {
    getIO().to(`doctor_${doctorId}`).emit('triage.updated', payload);
  } catch {}
};

export const broadcastQueueUpdate = (
  facilityId: string,
  doctorId: string | null,
  payload: any,
  patientId: string | null = null
) => {
  try {
    getIO().to(`facility_${facilityId}`).emit('queue.updated', payload);
    if (doctorId) {
      getIO().to(`doctor_${doctorId}`).emit('queue.updated', payload);
    }
    if (patientId) {
      getIO().to(`patient_${patientId}`).emit('queue.updated', payload);
    }
  } catch {}
};

export const broadcastPatientUpdate = (patientId: string, event: string, payload: any) => {
  try {
    getIO().to(`patient_${patientId}`).emit(event, payload);
    getIO().to(`patient_${patientId}`).emit('patient.updated', { type: event, ...payload });
  } catch {}
};

export const broadcastCounterReferral = (workerId: string, payload: any) => {
  try {
    getIO().to(`worker_${workerId}`).emit('counter_referral:created', payload);
  } catch {}
};

export const broadcastFollowUpCreated = (workerId: string, payload: any) => {
  try {
    getIO().to(`worker_${workerId}`).emit('followup:created', payload);
    getIO().emit('followup:created', payload);
  } catch {}
};

export const broadcastFollowUpUpdated = (workerId: string, payload: any) => {
  try {
    getIO().to(`worker_${workerId}`).emit('followup:updated', payload);
    getIO().emit('followup:updated', payload);
  } catch {}
};

export const broadcastTeleconsultationUpdate = (
  facilityId: string,
  doctorId: string | null,
  data: any
) => {
  const payload = {
    event: 'TELECONSULTATION_STATUS_CHANGED',
    facilityId,
    doctorId,
    timestamp: new Date().toISOString(),
    ...data
  };
  try {
    getIO().to(`facility_${facilityId}`).emit('TELECONSULTATION_STATUS_CHANGED', payload);
    if (doctorId) {
      getIO().to(`doctor_${doctorId}`).emit('TELECONSULTATION_STATUS_CHANGED', payload);
    }
  } catch {
    // Non-blocking
  }
  return payload;
};

