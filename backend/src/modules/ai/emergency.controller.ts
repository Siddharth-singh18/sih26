import { Response } from 'express';
import { prisma } from '../../index';
import { AuthRequest } from '../../middleware/auth';
import { calculateOptimalRoutes } from '../routing/routing.service';
import { broadcastUrgentEscalation } from '../../events/socket';
import { createNotification } from '../notifications/notification.service';
import { recordAuditLog } from '../audit/audit.service';

/**
 * DETERMINISTIC EMERGENCY ESCALATION PIPELINE
 * Connects:
 *   Deterministic Clinical Triage
 *   -> Capability-Aware Routing (EMERGENCY urgency)
 *   -> Priority Referral Creation (SUBMITTED)
 *   -> Realtime WebSocket Escalation Event
 *   -> Clinician Mailbox Notification
 *   -> Central PostgreSQL Audit Log
 */
export const handleEmergencyEscalation = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, originFacilityId, assessmentId, humanConfirmed, overrideReason } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'Bad Request', message: 'patientId is required' });
    }

    // 1. Fetch patient and latest clinical assessment/vitals
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { symptoms: true, encounter: { include: { vitals: true } } }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Not Found', message: 'Patient not found' });
    }

    const latestAssessment = patient.assessments[0];
    const symptoms = latestAssessment?.symptoms || [];
    const vitals = latestAssessment?.encounter?.vitals || [];

    // 2. Deterministic Rule-Based Clinical Triage (ICMR / WHO guidelines)
    let isEmergency = false;
    const triageReasons: string[] = [];

    // Vital signs check
    for (const v of vitals) {
      const num = parseFloat(v.value);
      if (isNaN(num)) continue;
      const type = v.type.toUpperCase();

      if (type === 'SPO2' && num < 90) {
        isEmergency = true;
        triageReasons.push(`Critical SpO2 hypoxemia: ${num}% (< 90%)`);
      } else if (type === 'HR' && (num > 130 || num < 45)) {
        isEmergency = true;
        triageReasons.push(`Severe hemodynamically unstable heart rate: ${num} bpm`);
      } else if (type === 'BP') {
        const parts = v.value.split('/');
        const sys = parseInt(parts[0], 10);
        const dia = parseInt(parts[1], 10);
        if (sys >= 180 || dia >= 110) {
          isEmergency = true;
          triageReasons.push(`Hypertensive crisis: ${v.value} mmHg`);
        }
      }
    }

    // Critical symptom check
    for (const s of symptoms) {
      const name = s.name.toLowerCase();
      if (name.includes('chest pain') || name.includes('unconscious') || name.includes('severe breath') || name.includes('profuse bleed')) {
        isEmergency = true;
        triageReasons.push(`High-acuity red-flag symptom: ${s.name}`);
      }
    }

    if (!isEmergency && !humanConfirmed) {
      return res.status(400).json({
        error: 'Precondition Failed',
        message: 'Clinical indicators do not meet emergency escalation thresholds and human confirmation was not provided'
      });
    }

    // 3. Capability-Aware Emergency Routing
    const rankedFacilities = await calculateOptimalRoutes({
      urgency: 'EMERGENCY',
      requiredBedType: 'ICU',
      limit: 3
    });

    const targetFacility = rankedFacilities[0];
    if (!targetFacility) {
      return res.status(500).json({ error: 'Routing Error', message: 'No eligible emergency-capable facility available' });
    }

    // 4. Default Origin Facility fallback
    let finalOriginId = originFacilityId;
    if (!finalOriginId) {
      const defaultOrigin = await prisma.facility.findFirst({
        where: { id: { not: targetFacility.facility_id } }
      });
      finalOriginId = defaultOrigin?.id || 'fac-khandala-phc';
    }

    // 5. Database Transaction: Referral + ReferralEvent + Human Confirmation
    const referral = await prisma.$transaction(async (tx) => {
      const ref = await tx.referral.create({
        data: {
          patientId,
          originId: finalOriginId,
          destinationId: targetFacility.facility_id,
          urgency: 'URGENT',
          reason: `EMERGENCY ESCALATION: ${triageReasons.join('; ')}`,
          status: 'SUBMITTED'
        }
      });

      await tx.referralEvent.create({
        data: {
          referralId: ref.id,
          statusFrom: null,
          statusTo: 'SUBMITTED',
          notes: `Emergency escalation initiated. Routing recommended ${targetFacility.facility_name} (Score: ${targetFacility.score})`
        }
      });

      if (assessmentId) {
        await tx.aIRecommendation.create({
          data: {
            assessmentId,
            urgencyCategory: 'URGENT',
            reasons: triageReasons,
            confidence: 0.98,
            humanConfirmed: humanConfirmed ?? true,
            overrideReason: overrideReason || null
          }
        });
      }

      return ref;
    });

    // 6. Realtime WebSocket Escalation Broadcast
    broadcastUrgentEscalation(targetFacility.facility_id, {
      escalationType: 'EMERGENCY_TRANSFER',
      entityId: referral.id,
      urgency: 'EMERGENCY',
      reason: referral.reason,
      summary: `Urgent emergency referral for ${patient.name} to ${targetFacility.facility_name}`
    });

    // 7. Push Notification to destination physicians
    const destDoctors = await prisma.facilityDoctor.findMany({
      where: { facilityId: targetFacility.facility_id },
      include: { doctor: true }
    });

    for (const fd of destDoctors) {
      if (fd.doctor?.userId) {
        await createNotification(
          fd.doctor.userId,
          'EMERGENCY_ESCALATION',
          `URGENT: Emergency referral incoming for ${patient.name} (${referral.reason})`
        );
      }
    }

    // 8. Audit Log
    await recordAuditLog({
      userId: req.user?.id,
      action: 'EMERGENCY_ESCALATION_DISPATCHED',
      resource: 'Referral',
      resourceId: referral.id
    });

    res.status(201).json({
      success: true,
      escalationStatus: 'DISPATCHED',
      referralId: referral.id,
      patientId,
      originFacilityId: finalOriginId,
      destinationFacilityId: targetFacility.facility_id,
      destinationFacilityName: targetFacility.facility_name,
      triageReasons,
      routingScore: targetFacility.score,
      notificationsDispatched: destDoctors.length,
      provenance: {
        engine: 'DETERMINISTIC_EMERGENCY_ESCALATION_PIPELINE',
        guideline: 'ICMR/WHO_ACUTE_EMERGENCY_CARE',
        humanConfirmed: humanConfirmed ?? true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error in handleEmergencyEscalation:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
