import { Request, Response } from 'express';
import { prisma } from '../../index';
import { broadcastQueueUpdate } from '../../events/socket';
import { AuthRequest } from '../../middleware/auth';

// 21. QUEUE ENGINE: Explicit queue states
export const enqueuePatient = async (req: Request, res: Response) => {
  try {
    const { appointmentId, patientId, facilityId, doctorId, priority } = req.body;

    let finalApptId = appointmentId;

    // Validate entities if creating a walk-in appointment
    if (!finalApptId && patientId && facilityId) {
      const [patientExists, facilityExists] = await Promise.all([
        prisma.patient.findUnique({ where: { id: patientId } }),
        prisma.facility.findUnique({ where: { id: facilityId } })
      ]);

      if (!patientExists) {
        return res.status(404).json({ error: 'Not Found', message: 'Patient not found' });
      }
      if (!facilityExists) {
        return res.status(404).json({ error: 'Not Found', message: 'Facility not found' });
      }

      const walkIn = await prisma.appointment.create({
        data: {
          patientId,
          facilityId,
          doctorId: doctorId || null,
          scheduledAt: new Date(),
          status: 'BOOKED'
        }
      });
      finalApptId = walkIn.id;
    }

    if (!finalApptId) {
      return res.status(400).json({ error: 'Bad Request', message: 'appointmentId or patientId+facilityId is required' });
    }

    const cleanPriority = Math.max(0, Math.min(100, parseInt(String(priority ?? 0), 10) || 0));

    const queueEntry = await prisma.queueEntry.create({
      data: {
        appointmentId: finalApptId,
        doctorId: doctorId || null,
        priority: cleanPriority,
        status: 'WAITING'
      },
      include: {
        appointment: true
      }
    });

    if (queueEntry.appointment?.facilityId) {
      broadcastQueueUpdate(queueEntry.appointment.facilityId, doctorId, {
        action: 'ENQUEUE',
        entry: queueEntry
      });
    }

    res.status(201).json(queueEntry);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getQueueForDoctor = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { doctorId } = req.params;

    // IDOR Protection: Doctor can only access their own queue, unless ADMIN
    const isAdmin = authReq.user?.roles.includes('ADMIN');
    if (!isAdmin && authReq.user?.doctorId && authReq.user.doctorId !== doctorId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only access your own consultation queue' });
    }

    const queue = await prisma.queueEntry.findMany({
      where: { doctorId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      orderBy: [
        { priority: 'desc' },
        { arrivalTime: 'asc' }
      ],
      include: {
        appointment: {
          include: {
            patient: {
              include: {
                assessments: {
                  include: { symptoms: true, aiRecommendations: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1
                }
              }
            },
            facility: true
          }
        },
        doctor: {
          include: {
            user: { select: { email: true, phone: true } },
            specialist: true
          }
        }
      }
    });
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateQueueStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const queueEntry = await prisma.queueEntry.findUnique({ where: { id } });
    if (!queueEntry) {
      return res.status(404).json({ error: 'Not Found', message: 'Queue entry not found' });
    }

    const currentStatus = queueEntry.status;

    // Define allowed transitions
    const VALID_QUEUE_TRANSITIONS: Record<string, string[]> = {
      'WAITING': ['IN_CONSULTATION', 'CANCELLED'],
      'PRIORITY': ['IN_CONSULTATION', 'CANCELLED'],
      'IN_CONSULTATION': ['COMPLETED', 'CANCELLED']
    };

    const allowed = VALID_QUEUE_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid Transition', message: `Cannot transition from ${currentStatus} to ${status}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const qEntry = await tx.queueEntry.update({
        where: { id },
        data: { status },
        include: {
          appointment: {
            include: { patient: true }
          }
        }
      });

      if (qEntry.appointmentId) {
        const apptStatus = status === 'IN_CONSULTATION'
          ? 'IN_CONSULTATION'
          : status === 'COMPLETED'
          ? 'COMPLETED'
          : status === 'CANCELLED'
          ? 'CANCELLED'
          : undefined;

        if (apptStatus) {
          await tx.appointment.update({
            where: { id: qEntry.appointmentId },
            data: { status: apptStatus }
          }).catch(() => {});
        }
      }

      return qEntry;
    });

    if (updated.appointment?.facilityId) {
      broadcastQueueUpdate(
        updated.appointment.facilityId,
        updated.doctorId,
        { action: 'UPDATE_STATUS', entry: updated },
        updated.appointment.patientId
      );
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getAllQueue = async (req: Request, res: Response) => {
  try {
    const { facilityId, doctorId, status } = req.query;

    const whereClause: any = {
      status: status ? String(status) : { notIn: ['COMPLETED', 'CANCELLED'] }
    };

    if (facilityId) {
      whereClause.appointment = { facilityId: String(facilityId) };
    }
    if (doctorId) {
      whereClause.doctorId = String(doctorId);
    }

    const queue = await prisma.queueEntry.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { arrivalTime: 'asc' }
      ],
      include: {
        appointment: {
          include: {
            patient: {
              include: {
                assessments: {
                  include: { symptoms: true, aiRecommendations: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1
                }
              }
            },
            facility: true
          }
        },
        doctor: {
          include: {
            user: { select: { email: true, phone: true } },
            specialist: true
          }
        }
      }
    });
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
