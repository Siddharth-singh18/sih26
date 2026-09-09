import { Request, Response } from 'express';
import { prisma } from '../../index';
import { broadcastTeleconsultationUpdate, broadcastQueueUpdate } from '../../events/socket';
import { recordAuditLog } from '../audit/audit.service';
import { AuthRequest } from '../../middleware/auth';

/**
 * ASSISTED TELECONSULTATION CONTROLLER
 * Explicit teleconsultation workflow where frontline worker/ASHA assists patient
 * and physician consults remotely.
 * Lifecycle: REQUESTED -> QUEUED -> IN_PROGRESS -> COMPLETED (or CANCELLED)
 */

export const requestTeleconsultation = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, facilityId, doctorId, reason, urgency } = req.body;

    if (!patientId || !facilityId) {
      return res.status(400).json({ error: 'Bad Request', message: 'patientId and facilityId are required' });
    }

    const [patient, facility] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.facility.findUnique({ where: { id: facilityId } })
    ]);

    if (!patient) return res.status(404).json({ error: 'Not Found', message: 'Patient not found' });
    if (!facility) return res.status(404).json({ error: 'Not Found', message: 'Facility not found' });

    // Calculate queue priority based on urgency
    const rawUrgency = String(urgency || 'ROUTINE').toUpperCase().trim();
    let priority = 10;
    if (rawUrgency === 'URGENT' || rawUrgency === 'EMERGENCY') priority = 80;
    else if (rawUrgency === 'PRIORITY') priority = 50;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Appointment with status REQUESTED
      const appt = await tx.appointment.create({
        data: {
          patientId,
          facilityId,
          doctorId: doctorId || null,
          scheduledAt: new Date(),
          status: 'REQUESTED'
        }
      });

      // 2. Enqueue into consultation queue
      const qEntry = await tx.queueEntry.create({
        data: {
          appointmentId: appt.id,
          doctorId: doctorId || null,
          priority,
          status: 'WAITING'
        },
        include: {
          appointment: {
            include: {
              patient: true,
              facility: true
            }
          }
        }
      });

      return { appt, qEntry };
    });

    // Central Audit Log
    await recordAuditLog({
      userId: req.user?.id,
      action: 'TELECONSULTATION_REQUESTED',
      resource: 'Appointment',
      resourceId: result.appt.id
    });

    // Realtime Broadcast
    broadcastTeleconsultationUpdate(facilityId, doctorId || null, {
      action: 'REQUESTED',
      teleconsultationId: result.appt.id,
      patientName: patient.name,
      priority,
      reason: reason || 'Assisted frontline teleconsultation'
    });

    broadcastQueueUpdate(facilityId, doctorId || null, {
      action: 'ENQUEUE',
      entry: result.qEntry
    }, patientId);

    res.status(201).json({
      success: true,
      mode: 'ASSISTED_TELECONSULTATION',
      teleconsultationId: result.appt.id,
      status: 'REQUESTED',
      queueStatus: 'WAITING',
      appointment: result.appt,
      queueEntry: result.qEntry
    });
  } catch (error: any) {
    console.error('Error in requestTeleconsultation:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const listTeleconsultations = async (req: AuthRequest, res: Response) => {
  try {
    const { facilityId, doctorId, patientId, status } = req.query;

    const where: any = {};
    if (facilityId) where.facilityId = String(facilityId);
    if (doctorId) where.doctorId = String(doctorId);
    if (patientId) where.patientId = String(patientId);
    if (status) where.status = String(status);

    const teleconsultations = await prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        facility: true,
        doctor: {
          include: {
            specialist: true
          }
        },
        queueEntry: true
      },
      orderBy: { scheduledAt: 'desc' },
      take: 50
    });

    res.json(teleconsultations);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateTeleconsultationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, clinicalNotes, diagnosis, prescriptions } = req.body;

    const validStatuses = ['REQUESTED', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: { queueEntry: true, patient: true }
    });

    if (!appt) {
      return res.status(404).json({ error: 'Not Found', message: 'Teleconsultation appointment not found' });
    }

    let encounterId: string | undefined;

    await prisma.$transaction(async (tx) => {
      // Update Appointment status
      await tx.appointment.update({
        where: { id },
        data: { status }
      });

      // Update QueueEntry if exists
      if (appt.queueEntry) {
        let queueStatus = 'WAITING';
        if (status === 'IN_PROGRESS') queueStatus = 'IN_CONSULTATION';
        else if (status === 'COMPLETED') queueStatus = 'COMPLETED';
        else if (status === 'CANCELLED') queueStatus = 'COMPLETED';

        await tx.queueEntry.update({
          where: { id: appt.queueEntry.id },
          data: { status: queueStatus }
        });
      }

      // If IN_PROGRESS or COMPLETED, manage Encounter
      if (status === 'IN_PROGRESS') {
        const encounter = await tx.encounter.create({
          data: {
            patientId: appt.patientId,
            facilityId: appt.facilityId,
            type: 'TELECONSULTATION',
            status: 'IN_PROGRESS',
            start: new Date()
          }
        });
        encounterId = encounter.id;
      } else if (status === 'COMPLETED') {
        // Create or complete encounter
        const encounter = await tx.encounter.create({
          data: {
            patientId: appt.patientId,
            facilityId: appt.facilityId,
            type: 'TELECONSULTATION',
            status: 'COMPLETED',
            start: new Date(),
            end: new Date()
          }
        });
        encounterId = encounter.id;

        if (clinicalNotes) {
          await tx.clinicalObservation.create({
            data: {
              encounterId: encounter.id,
              note: clinicalNotes,
              provenance: 'DOCTOR_TELECONSULTATION'
            }
          });
        }

        if (diagnosis) {
          await tx.condition.create({
            data: {
              patientId: appt.patientId,
              name: diagnosis,
              status: 'ACTIVE',
              diagnosedAt: new Date()
            }
          });
        }

        if (Array.isArray(prescriptions)) {
          for (const rx of prescriptions) {
            if (rx.medication && rx.dosage) {
              await tx.prescription.create({
                data: {
                  encounterId: encounter.id,
                  medication: rx.medication,
                  dosage: rx.dosage,
                  duration: rx.duration || '5 days',
                  instructions: rx.instructions || 'As advised in teleconsultation'
                }
              });
            }
          }
        }
      }
    });

    // Record Audit
    await recordAuditLog({
      userId: req.user?.id,
      action: `TELECONSULTATION_${status}`,
      resource: 'Appointment',
      resourceId: id
    });

    // Realtime Broadcast
    broadcastTeleconsultationUpdate(appt.facilityId, appt.doctorId, {
      action: 'STATUS_UPDATE',
      teleconsultationId: id,
      patientId: appt.patientId,
      status,
      encounterId
    });

    res.json({
      success: true,
      teleconsultationId: id,
      status,
      encounterId
    });
  } catch (error: any) {
    console.error('Error in updateTeleconsultationStatus:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
