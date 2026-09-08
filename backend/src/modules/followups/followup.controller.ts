import { Request, Response } from 'express';
import { prisma } from '../../index';
import { getIO, broadcastPatientUpdate, broadcastQueueUpdate } from '../../events/socket';
import { createNotification } from '../notifications/notification.service';
import { AuthRequest } from '../../middleware/auth';

/**
 * COUNTER-REFERRAL ENDPOINT
 * Called by the doctor after a consultation to close the referral loop.
 * Creates structured FollowUp tasks that appear instantly on the ASHA worker's dashboard,
 * writes real Encounter and Prescription records to PostgreSQL, and syncs queue status.
 *
 * POST /api/followups/counter-referral
 */
export const createCounterReferral = async (req: Request, res: Response) => {
  try {
    const {
      referralId,
      outcome,
      treatment,
      instructions,
      tasks = [],
      medications = [],
      requiresFollowUp,
      followUpDate,
      assignedWorkerId,
      diagnosticOrders = []
    } = req.body;

    if (!referralId) {
      return res.status(400).json({ error: 'referralId is required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch referral or resolve queue entry / patient
      let referral = await tx.referral.findUnique({
        where: { id: referralId },
        include: { patient: true }
      });

      let targetPatientId = referral?.patientId;
      let targetFacilityId = referral?.destinationId;
      let targetDoctorId: string | null = null;
      let resolvedQueueEntryId: string | null = null;

      // If referralId was actually a QueueEntry ID
      if (!referral) {
        const qEntry = await tx.queueEntry.findUnique({
          where: { id: referralId },
          include: { appointment: { include: { patient: true } } }
        });

        if (qEntry && qEntry.appointment) {
          resolvedQueueEntryId = qEntry.id;
          targetPatientId = qEntry.appointment.patientId;
          targetFacilityId = qEntry.appointment.facilityId;
          targetDoctorId = qEntry.doctorId;

          // Check if patient already has an active referral
          referral = await tx.referral.findFirst({
            where: { patientId: targetPatientId },
            include: { patient: true }
          });

          // Mark queue entry as COMPLETED and synchronize linked appointment
          await tx.queueEntry.update({
            where: { id: qEntry.id },
            data: { status: 'COMPLETED' }
          }).catch(() => {});

          if (qEntry.appointmentId) {
            await tx.appointment.update({
              where: { id: qEntry.appointmentId },
              data: { status: 'COMPLETED' }
            }).catch(() => {});
          }
        }
      }

      // If still not found, check if referralId was directly a patientId
      if (!referral && !targetPatientId) {
        const pat = await tx.patient.findUnique({ where: { id: referralId } });
        if (pat) targetPatientId = pat.id;
      }

      // If no referral exists, auto-create one so counter-referral FK is satisfied
      if (!referral && targetPatientId) {
        // Find default facilities
        const facs = await tx.facility.findMany({ take: 2 });
        const originId = facs[1]?.id || facs[0]?.id || 'fac-khandala-phc';
        const destinationId = targetFacilityId || facs[0]?.id || 'fac-baramati-chc';
        targetFacilityId = destinationId;

        referral = await tx.referral.create({
          data: {
            patientId: targetPatientId,
            originId,
            destinationId,
            reason: outcome || 'Consultation referral',
            urgency: 'ROUTINE',
            status: 'COUNTER_REFERRED'
          },
          include: { patient: true }
        });
      }

      if (!referral) {
        throw new Error(`Referral or patient for ${referralId} could not be resolved`);
      }

      if (!targetFacilityId) {
        targetFacilityId = referral.destinationId;
      }

      // 2. Create or upsert CounterReferral record
      const counter = await tx.counterReferral.upsert({
        where: { referralId: referral.id },
        update: {
          outcome: outcome || 'Consultation completed',
          treatment: treatment || '',
          instructions: instructions || '',
          requiresFollowUp: tasks.length > 0 || requiresFollowUp || false,
        },
        create: {
          referralId: referral.id,
          outcome: outcome || 'Consultation completed',
          treatment: treatment || '',
          instructions: instructions || '',
          requiresFollowUp: tasks.length > 0 || requiresFollowUp || false,
        }
      });

      // 3. Mark referral as COUNTER_REFERRED
      await tx.referral.update({
        where: { id: referral.id },
        data: { status: 'COUNTER_REFERRED' }
      }).catch(() => {});

      // 4. Create Clinical Encounter representing this consultation
      const encounter = await tx.encounter.create({
        data: {
          patientId: referral.patientId,
          facilityId: targetFacilityId,
          type: 'CLINIC_VISIT',
          status: 'COMPLETED',
          start: new Date(),
          end: new Date()
        }
      });

      // 5. Create structured Prescription records in PostgreSQL
      const createdPrescriptions: any[] = [];
      for (const med of medications) {
        const medName = med.name || med.medication;
        if (medName && String(medName).trim()) {
          const rx = await tx.prescription.create({
            data: {
              encounterId: encounter.id,
              medication: String(medName).trim(),
              dosage: med.dosage || '1 tab OD',
              duration: med.duration || '5 days',
              instructions: med.instructions || instructions || 'Take with water after meals'
            }
          });
          createdPrescriptions.push(rx);
        }
      }

      // 6. Record Clinical Observation note with DOCTOR provenance
      const obsNote = [outcome, treatment, instructions].filter(Boolean).join('. ');
      if (obsNote) {
        await tx.clinicalObservation.create({
          data: {
            encounterId: encounter.id,
            note: obsNote,
            provenance: 'DOCTOR_RECORDED'
          }
        });
      }

      // 7. Record Diagnostic Orders if requested
      const createdDiagnostics: any[] = [];
      for (const diag of diagnosticOrders) {
        const testName = typeof diag === 'string' ? diag : diag.testName;
        if (testName && String(testName).trim()) {
          const diagOrder = await tx.diagnosticOrder.create({
            data: {
              testName: String(testName).trim(),
              status: diag.status || 'PENDING'
            }
          });
          createdDiagnostics.push(diagOrder);
        }
      }

      // 8. Resolve worker for tasks
      let workerIdForTasks = assignedWorkerId;
      if (!workerIdForTasks) {
        const defaultWorker = await tx.worker.findFirst();
        workerIdForTasks = defaultWorker?.id;
      }

      // 9. Create structured FollowUp tasks for ASHA worker
      const createdFollowUps: any[] = [];
      for (const task of tasks.slice(0, 5)) {
        const title = task.title || task.taskTitle;
        if (!title) continue;
        let dueDate = new Date();
        if (task.dueDate) {
          dueDate = new Date(task.dueDate);
        } else {
          dueDate.setDate(dueDate.getDate() + (task.dueInDays || 3));
        }

        const followUp = await tx.followUp.create({
          data: {
            patientId: referral.patientId,
            workerId: workerIdForTasks || undefined,
            dueDate,
            reason: title,
            notes: medications.length > 0
              ? `Medications: ${medications.map((m: any) => `${m.name || m.medication} ${m.dosage || ''}`).join(', ')}`
              : undefined,
            status: 'PENDING'
          },
          include: { patient: { select: { name: true, id: true } } }
        });
        createdFollowUps.push(followUp);
      }

      // Legacy single follow-up support
      if (requiresFollowUp && followUpDate && tasks.length === 0) {
        const followUp = await tx.followUp.create({
          data: {
            patientId: referral.patientId,
            workerId: workerIdForTasks || undefined,
            dueDate: new Date(followUpDate),
            reason: `Follow-up after counter-referral: ${outcome}`,
            status: 'PENDING'
          },
          include: { patient: { select: { name: true, id: true } } }
        });
        createdFollowUps.push(followUp);
      }

      // 10. Send in-app notification to worker
      if (workerIdForTasks) {
        const worker = await tx.worker.findUnique({ where: { id: workerIdForTasks } });
        if (worker) {
          await createNotification(
            worker.userId,
            'FOLLOW_UP',
            `Doctor assigned ${createdFollowUps.length} follow-up task(s) for patient ${referral.patient?.name || referral.patientId}`
          );
        }
      }

      return {
        counter,
        followUps: createdFollowUps,
        referral,
        encounter,
        prescriptions: createdPrescriptions,
        diagnostics: createdDiagnostics,
        resolvedQueueEntryId,
        targetFacilityId,
        targetDoctorId
      };
    });

    // 11. Broadcast real-time events via Socket.io
    try {
      const io = getIO();
      io.emit('counter_referral:created', {
        referralId: result.referral.id,
        patientId: result.referral.patientId,
        patient: result.referral.patient,
        followUps: result.followUps,
        medications,
        doctorInstructions: instructions,
        createdAt: new Date().toISOString(),
      });

      broadcastPatientUpdate(result.referral.patientId, 'prescription.added', {
        encounterId: result.encounter.id,
        prescriptions: result.prescriptions
      });
      broadcastPatientUpdate(result.referral.patientId, 'patient.updated', {
        type: 'consultation.completed',
        encounterId: result.encounter.id
      });

      if (result.targetFacilityId && result.resolvedQueueEntryId) {
        broadcastQueueUpdate(
          result.targetFacilityId,
          result.targetDoctorId,
          { action: 'UPDATE_STATUS', entry: { id: result.resolvedQueueEntryId, status: 'COMPLETED' } },
          result.referral.patientId
        );
      }
    } catch {
      // Socket emit failure must never break the HTTP response
    }

    res.status(201).json({
      counterReferral: result.counter,
      followUps: result.followUps,
      encounter: result.encounter,
      prescriptions: result.prescriptions,
      diagnostics: result.diagnostics,
      message: `Counter-referral created. ${result.followUps.length} follow-up task(s) assigned to worker.`
    });
  } catch (error: any) {
    console.error('[followup] createCounterReferral error:', error.message);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};

/**
 * LIST FOLLOW-UPS FOR A WORKER OR DASHBOARD
 * GET /api/followups?status=PENDING|OVERDUE|COMPLETED
 */
export const listFollowUps = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { status, patientId } = req.query;

    const where: any = {};
    if (status === 'OVERDUE') {
      where.OR = [
        { status: 'OVERDUE' },
        { status: 'PENDING', dueDate: { lt: new Date() } }
      ];
    } else if (status) {
      where.status = status as string;
    }
    if (patientId) where.patientId = patientId as string;

    // Workers only access their own assigned follow-up tasks (Doctors and Admins can view all)
    const userRoles = user?.roles || [];
    const isStaff = userRoles.some(r => ['DOCTOR', 'ADMIN'].includes(r));
    if (userRoles.includes('WORKER') && !isStaff) {
      let workerId = user?.workerId;
      if (!workerId && user?.id) {
        const worker = await prisma.worker.findUnique({ where: { userId: user.id } }).catch(() => null);
        workerId = worker?.id;
      }
      if (workerId) {
        where.workerId = workerId;
      } else {
        return res.json([]);
      }
    }

    const followUps = await prisma.followUp.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            village: true,
            phone: true
          }
        }
      },
      orderBy: { dueDate: 'asc' },
      take: 100,
    });

    res.json(followUps);
  } catch (error: any) {
    console.error('[followup] listFollowUps error:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * MARK FOLLOW-UP COMPLETE
 * PATCH /api/followups/:id/complete
 */
export const completeFollowUp = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { id } = req.params;
    const { completionNotes } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Follow-up ID is required' });
    }

    const existing = await prisma.followUp.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Follow-up task not found' });
    }

    // IDOR Protection: Health worker can only complete tasks assigned to them
    const userRoles = user?.roles || [];
    const isStaff = userRoles.some(r => ['DOCTOR', 'ADMIN'].includes(r));
    if (userRoles.includes('WORKER') && !isStaff) {
      let userWorkerId = user?.workerId;
      if (!userWorkerId && user?.id) {
        const worker = await prisma.worker.findUnique({ where: { userId: user.id } }).catch(() => null);
        userWorkerId = worker?.id;
      }
      if (existing.workerId && userWorkerId && existing.workerId !== userWorkerId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to complete tasks assigned to another health worker'
        });
      }
    }

    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: completionNotes
          ? `${existing.notes ? existing.notes + ' | ' : ''}${completionNotes}`
          : existing.notes
      },
      include: {
        patient: { select: { id: true, name: true } }
      }
    });

    // Realtime notification to worker room and dashboard
    try {
      const io = getIO();
      if (updated.workerId) {
        io.to(`worker_${updated.workerId}`).emit('followup:completed', updated);
      }
      io.emit('followup:updated', updated);
    } catch {
      // Non-blocking
    }

    res.json({ success: true, followUp: updated });
  } catch (error: any) {
    console.error('[followup] completeFollowUp error:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
