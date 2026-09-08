import { Request, Response } from 'express';
import { prisma } from '../../index';
import { AuthRequest } from '../../middleware/auth';
import { broadcastQueueUpdate, broadcastPatientUpdate } from '../../events/socket';
import { sanitizeString, validateAge, validatePhone, validateEnum } from '../../utils/validators';

// 10. PATIENT RECORD: creation, search, profile, history, timeline
// 11. ENCOUNTERS: Create explicit encounters

export const createPatient = async (req: Request, res: Response) => {
  try {
    const { name, dob, age, gender, village, phone, abhaId } = req.body;
    
    // Validate Patient Name
    const nameCheck = sanitizeString(name, 2, 100);
    if (!nameCheck.valid) {
      return res.status(400).json({ error: 'Bad Request', message: `Patient name: ${nameCheck.error}` });
    }

    // Validate Gender
    const genderCheck = validateEnum(gender ? String(gender).toUpperCase() : '', ['MALE', 'FEMALE', 'OTHER'] as const, 'Gender');
    if (!genderCheck.valid) {
      return res.status(400).json({ error: 'Bad Request', message: genderCheck.error });
    }

    // Validate Age
    const ageCheck = validateAge(age);
    if (!ageCheck.valid) {
      return res.status(400).json({ error: 'Bad Request', message: ageCheck.error });
    }

    // Validate Phone (optional)
    let validatedPhone: string | undefined = undefined;
    if (phone) {
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ error: 'Bad Request', message: phoneCheck.error });
      }
      validatedPhone = phoneCheck.normalized;

      // Duplicate mobile check to prevent duplicate community patient records
      const phoneClean = validatedPhone.replace(/[\s-]/g, '');
      const phoneVariants = [phoneClean];
      if (phoneClean.startsWith('+91')) {
        phoneVariants.push(phoneClean.slice(3));
      } else {
        phoneVariants.push('+91' + phoneClean);
      }

      const existingPhonePatient = await prisma.patient.findFirst({
        where: { phone: { in: phoneVariants } }
      });
      if (existingPhonePatient) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'A patient with this mobile number is already registered in the community registry',
          candidate: existingPhonePatient.id
        });
      }
    }

    // Validate ABHA ID format & duplicates (optional)
    let cleanAbha: string | undefined = undefined;
    if (abhaId) {
      const abhaCheck = sanitizeString(abhaId, 3, 30);
      if (!abhaCheck.valid) {
        return res.status(400).json({ error: 'Bad Request', message: `ABHA ID: ${abhaCheck.error}` });
      }
      cleanAbha = abhaCheck.value;

      // Prevent duplicate patients with same ABHA ID
      const existing = await prisma.patientIdentifier.findUnique({
        where: { value: cleanAbha }
      });
      if (existing) {
        return res.status(409).json({ error: 'Conflict', message: 'Patient with this ABHA ID already exists', candidate: existing.patientId });
      }
    }

    const patient = await prisma.patient.create({
      data: {
        name: nameCheck.value,
        dob: dob ? new Date(dob) : null,
        age: ageCheck.age,
        gender: genderCheck.value!,
        village: village ? String(village).trim() : null,
        phone: validatedPhone,
        identifiers: cleanAbha ? {
          create: {
            type: 'ABHA',
            value: cleanAbha
          }
        } : undefined
      }
    });

    res.status(201).json(patient);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const searchPatients = async (req: Request, res: Response) => {
  try {
    const qStr = String(req.query.q || req.query.query || '').trim();
    const villageParam = req.query.village ? String(req.query.village).trim() : '';

    const whereConditions: any[] = [];

    if (qStr) {
      whereConditions.push({
        OR: [
          { name: { contains: qStr, mode: 'insensitive' as const } },
          { phone: { contains: qStr } },
          { identifiers: { some: { value: qStr } } },
          { village: { contains: qStr, mode: 'insensitive' as const } }
        ]
      });
    }

    if (villageParam) {
      whereConditions.push({
        village: { contains: villageParam, mode: 'insensitive' as const }
      });
    }

    const whereCondition = whereConditions.length > 0
      ? { AND: whereConditions }
      : {};

    const patients = await prisma.patient.findMany({
      where: whereCondition,
      include: {
        identifiers: true,
        encounters: {
          take: 1,
          orderBy: { start: 'desc' },
          select: { id: true, type: true, start: true }
        }
      },
      take: 50,
      orderBy: { createdAt: 'desc' }
    });
    const mapped = patients.map(p => ({
      ...p,
      abhaId: p.identifiers?.find(i => i.type === 'ABHA')?.value || null
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getPatientTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // IDOR Protection: If requester has PATIENT role and not DOCTOR/WORKER/ADMIN, enforce own patient ID
    const isStaffOrAdmin = req.user?.roles.some(r => ['DOCTOR', 'WORKER', 'ADMIN'].includes(r));
    if (!isStaffOrAdmin && req.user?.roles.includes('PATIENT')) {
      if (!req.user.patientId || req.user.patientId !== id) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only access your own health records' });
      }
    }

    // Fetch longitudinal record
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        identifiers: true,
        encounters: {
          include: {
            assessments: { include: { symptoms: true, aiRecommendations: true } },
            vitals: true,
            prescriptions: true,
            clinicalObs: true,
            facility: true
          },
          orderBy: { start: 'desc' }
        },
        referrals: {
          include: {
            origin: true,
            destination: true,
            events: { orderBy: { createdAt: 'desc' } },
            counterReferral: true
          },
          orderBy: { events: { _count: 'desc' } }
        },
        conditions: { where: { status: 'ACTIVE' } }
      }
    });

    if (!patient) return res.status(404).json({ error: 'Not found' });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createEncounter = async (req: Request, res: Response) => {
  try {
    const { patientId, facilityId, type } = req.body;
    
    if (!patientId || typeof patientId !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'patientId is required' });
    }

    const patientExists = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patientExists) {
      return res.status(404).json({ error: 'Not Found', message: 'Patient does not exist' });
    }

    const typeCheck = validateEnum(type, ['FIELD_VISIT', 'CLINIC_VISIT', 'EMERGENCY', 'HOME_VISIT'] as const, 'Encounter type');
    const validEncounterType = typeCheck.valid ? typeCheck.value! : 'FIELD_VISIT';

    const encounter = await prisma.encounter.create({
      data: {
        patientId,
        facilityId: facilityId || null,
        type: validEncounterType,
        status: 'IN_PROGRESS'
      }
    });
    
    res.status(201).json(encounter);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export function formatDoctorName(doctor?: {
  id?: string;
  user?: { email?: string | null; phone?: string | null } | null;
  name?: string | null;
  specialist?: { specialty?: string | null } | null;
} | null): string {
  if (!doctor) return 'Medical Officer';
  if (doctor.name) return doctor.name;

  // From user email: 'rajesh.deshmukh@ayusync.org' -> 'Dr. Rajesh Deshmukh'
  if (doctor.user?.email) {
    const username = doctor.user.email.split('@')[0];
    const parts = username.split(/[._-]/);
    const capitalized = parts
      .filter(p => p.length > 0)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
    if (capitalized) return `Dr. ${capitalized}`;
  }

  // From doctor ID: 'doc-rajesh-deshmukh' -> 'Dr. Rajesh Deshmukh'
  if (doctor.id) {
    const parts = doctor.id.replace(/^doc-/, '').split(/[._-]/);
    const capitalized = parts
      .filter(p => p.length > 0)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
    if (capitalized) return `Dr. ${capitalized}`;
  }

  return 'Medical Officer';
}

// ─── PATIENT SELF-SERVICE APIS ───────────────────────────────────────────────

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        identifiers: true,
        conditions: { where: { status: 'ACTIVE' } }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Not Found', message: 'Patient profile not found' });
    }

    const abhaId = patient.identifiers?.find(i => i.type === 'ABHA')?.value || null;

    res.json({
      ...patient,
      abhaId
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMyTimeline = async (req: AuthRequest, res: Response) => {
  req.params.id = req.user?.patientId || '';
  return getPatientTimeline(req, res);
};

export const getMyHealthSummary = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    const [
      patient,
      latestEncounters,
      activeReferralsCount,
      upcomingAppointmentsCount,
      totalEncounters,
      totalReferrals
    ] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          identifiers: true,
          conditions: { where: { status: 'ACTIVE' } }
        }
      }),
      prisma.encounter.findMany({
        where: { patientId },
        include: {
          vitals: { orderBy: { measuredAt: 'desc' } },
          prescriptions: true,
          assessments: { include: { aiRecommendations: true } }
        },
        orderBy: { start: 'desc' },
        take: 5
      }),
      prisma.referral.count({
        where: { patientId, status: { in: ['CREATED', 'SUBMITTED', 'ACCEPTED'] } }
      }),
      prisma.appointment.count({
        where: { patientId, status: { in: ['BOOKED', 'SCHEDULED'] }, scheduledAt: { gte: new Date() } }
      }),
      prisma.encounter.count({ where: { patientId } }),
      prisma.referral.count({ where: { patientId } })
    ]);

    if (!patient) {
      return res.status(404).json({ error: 'Not Found', message: 'Patient profile not found' });
    }

    const abhaId = patient.identifiers?.find(i => i.type === 'ABHA')?.value || null;

    // Collect latest vitals across recent encounters
    const vitalsMap: Record<string, any> = {};
    for (const enc of latestEncounters) {
      for (const v of enc.vitals) {
        if (!vitalsMap[v.type]) {
          vitalsMap[v.type] = v;
        }
      }
    }

    const latestVitalsArray = Object.values(vitalsMap);
    const bpVital = vitalsMap['BP']?.value; // e.g. "136/86"
    let systolic: number | string | null = null;
    let diastolic: number | string | null = null;
    if (bpVital && typeof bpVital === 'string' && bpVital.includes('/')) {
      const parts = bpVital.split('/');
      systolic = parts[0].trim();
      diastolic = parts[1].trim();
    }

    const heartRate = vitalsMap['HR']?.value || null;
    const bloodGlucose = vitalsMap['BLOOD_GLUCOSE']?.value || null;
    const spo2 = vitalsMap['SPO2']?.value || null;
    const temperature = vitalsMap['TEMPERATURE']?.value || null;
    const recordedAt = latestVitalsArray.length > 0
      ? latestVitalsArray.reduce((latest, v) => new Date(v.measuredAt) > new Date(latest) ? v.measuredAt : latest, latestVitalsArray[0].measuredAt)
      : null;

    const recentVitals = {
      systolic,
      diastolic,
      bp: bpVital || null,
      heartRate,
      bloodGlucose,
      spo2,
      temperature,
      recordedAt
    };

    // Collect active medications
    const recentPrescriptions = latestEncounters.flatMap(e => e.prescriptions).map(rx => ({
      ...rx,
      name: rx.medication,
      medication: rx.medication
    }));

    res.json({
      patient: {
        ...patient,
        abhaId
      },
      latestVitals: latestVitalsArray,
      recentVitals,
      activeConditions: patient.conditions,
      recentPrescriptions,
      activeReferralsCount,
      upcomingAppointmentsCount,
      totalEncounters,
      totalReferrals
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMyAppointments = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      include: {
        facility: true,
        doctor: {
          include: {
            user: { select: { email: true, phone: true } },
            specialist: true
          }
        },
        queueEntry: true
      },
      orderBy: { scheduledAt: 'desc' }
    });

    const enriched = appointments.map((appt) => {
      const sched = new Date(appt.scheduledAt);
      const dateStr = !isNaN(sched.getTime()) ? sched.toISOString().split('T')[0] : '';
      const timeSlotStr = !isNaN(sched.getTime())
        ? sched.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '10:00 AM';

      const doctorName = formatDoctorName(appt.doctor);
      const doctorSpecialty = appt.doctor?.specialist?.specialty || 'General Medicine';

      const tokenNumber = appt.queueEntry
        ? `TK-2026-${(appt.queueEntry.id.replace(/\D/g, '') || appt.id.slice(-3)).padStart(3, '0').slice(-3)}`
        : null;

      return {
        ...appt,
        date: dateStr,
        timeSlot: timeSlotStr,
        doctor: appt.doctor ? {
          id: appt.doctor.id,
          name: doctorName,
          specialty: doctorSpecialty,
          phone: appt.doctor.user?.phone || null,
          email: appt.doctor.user?.email || null
        } : null,
        queueEntry: appt.queueEntry ? {
          ...appt.queueEntry,
          tokenNumber
        } : null
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const bookMyAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    const { facilityId, doctorId, scheduledAt, date, timeSlot, reason } = req.body;

    if (!facilityId) {
      return res.status(400).json({ error: 'Bad Request', message: 'facilityId is required' });
    }

    let schedDate: Date;
    if (scheduledAt) {
      schedDate = new Date(scheduledAt);
    } else if (date) {
      const slot = timeSlot || '10:00 AM';
      schedDate = new Date(`${date} ${slot}`);
      if (isNaN(schedDate.getTime())) {
        schedDate = new Date(date);
      }
    } else {
      return res.status(400).json({ error: 'Bad Request', message: 'scheduledAt or date is required' });
    }

    if (isNaN(schedDate.getTime())) {
      return res.status(400).json({ error: 'Bad Request', message: 'scheduledAt must be a valid date' });
    }

    // Verify facility exists
    const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
    if (!facility) return res.status(404).json({ error: 'Not Found', message: 'Facility not found' });

    // Resolve doctor if not supplied
    let resolvedDoctorId = doctorId;
    if (!resolvedDoctorId) {
      const facDoc = await prisma.facilityDoctor.findFirst({ where: { facilityId } });
      if (facDoc) {
        resolvedDoctorId = facDoc.doctorId;
      } else {
        const anyDoc = await prisma.doctor.findFirst();
        resolvedDoctorId = anyDoc?.id;
      }
    }

    if (resolvedDoctorId) {
      const doctor = await prisma.doctor.findUnique({ where: { id: resolvedDoctorId } });
      if (!doctor) return res.status(404).json({ error: 'Not Found', message: 'Doctor not found' });
    }

    // Check for duplicate booking at exact same slot for this patient
    const existing = await prisma.appointment.findFirst({
      where: {
        patientId,
        scheduledAt: schedDate,
        status: { in: ['BOOKED', 'SCHEDULED'] }
      }
    });
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'You already have an appointment booked for this time slot' });
    }

    // Atomic creation of appointment and queue entry
    const appointment = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          patientId,
          facilityId,
          doctorId: resolvedDoctorId,
          scheduledAt: schedDate,
          status: 'SCHEDULED',
          queueEntry: {
            create: {
              doctorId: resolvedDoctorId,
              priority: 0,
              status: 'WAITING',
              arrivalTime: schedDate
            }
          }
        },
        include: {
          facility: true,
          doctor: {
            include: {
              specialist: true,
              user: { select: { email: true, phone: true } }
            }
          },
          queueEntry: true
        }
      });
      return appt;
    });

    const tokenNumber = `TK-2026-${(appointment.queueEntry?.id.replace(/\D/g, '') || appointment.id.slice(-3)).padStart(3, '0').slice(-3)}`;
    const result = {
      ...appointment,
      date: appointment.scheduledAt.toISOString().split('T')[0],
      timeSlot: timeSlot || '10:00 AM',
      reason: reason || 'Routine consultation',
      doctor: appointment.doctor ? {
        id: appointment.doctor.id,
        name: formatDoctorName(appointment.doctor),
        specialty: appointment.doctor.specialist?.specialty || 'General Medicine',
        phone: appointment.doctor.user?.phone || null,
        email: appointment.doctor.user?.email || null
      } : null,
      queueEntry: appointment.queueEntry ? { ...appointment.queueEntry, tokenNumber } : null
    };

    // Realtime notification
    broadcastQueueUpdate(facilityId, resolvedDoctorId, result.queueEntry, patientId);
    broadcastPatientUpdate(patientId, 'appointment.booked', result);

    res.status(201).json(result);
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const cancelMyAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    const { id } = req.params;

    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { queueEntry: true }
    });

    if (!appointment || appointment.patientId !== patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'Appointment not found' });
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Bad Request', message: `Cannot cancel an appointment that is ${appointment.status}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });
      if (appointment.queueEntry) {
        await tx.queueEntry.update({
          where: { id: appointment.queueEntry.id },
          data: { status: 'CANCELLED' }
        });
      }
      return appt;
    });

    broadcastQueueUpdate(appointment.facilityId, appointment.doctorId, { appointmentId: id, status: 'CANCELLED' }, patientId);
    broadcastPatientUpdate(patientId, 'appointment.cancelled', { appointmentId: id });

    res.json({ success: true, message: 'Appointment cancelled successfully', appointment: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMyReferrals = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    const referrals = await prisma.referral.findMany({
      where: { patientId },
      include: {
        origin: true,
        destination: true,
        events: { orderBy: { createdAt: 'desc' } },
        counterReferral: true
      },
      orderBy: { events: { _count: 'desc' } }
    });

    res.json(referrals);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMyPrescriptions = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    const prescriptions = await prisma.prescription.findMany({
      where: {
        encounter: { patientId }
      },
      include: {
        encounter: {
          include: {
            facility: true
          }
        }
      },
      orderBy: { encounter: { start: 'desc' } }
    });

    const enriched = prescriptions.map((rx) => ({
      ...rx,
      name: rx.medication,
      medication: rx.medication
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMyQueue = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    const activeQueue = await prisma.queueEntry.findFirst({
      where: {
        appointment: { patientId },
        status: { in: ['WAITING', 'IN_CONSULTATION', 'PRIORITY'] }
      },
      include: {
        appointment: {
          include: {
            facility: true,
            doctor: {
              include: {
                specialist: true,
                user: { select: { email: true, phone: true } }
              }
            }
          }
        }
      },
      orderBy: { arrivalTime: 'desc' }
    });

    if (!activeQueue) {
      return res.json({ active: false, inQueue: false, entry: null });
    }

    const aheadCount = await prisma.queueEntry.count({
      where: {
        doctorId: activeQueue.doctorId,
        status: { in: ['WAITING', 'PRIORITY'] },
        arrivalTime: { lt: activeQueue.arrivalTime }
      }
    });

    const tokenNumber = `TK-2026-${(activeQueue.id.replace(/\D/g, '') || activeQueue.id.slice(-3)).padStart(3, '0').slice(-3)}`;

    const doctorObj = activeQueue.appointment?.doctor ? {
      id: activeQueue.appointment.doctor.id,
      name: formatDoctorName(activeQueue.appointment.doctor),
      specialty: activeQueue.appointment.doctor.specialist?.specialty || 'General Medicine'
    } : null;

    res.json({
      active: true,
      inQueue: true,
      entry: {
        ...activeQueue,
        tokenNumber,
        facility: activeQueue.appointment?.facility,
        doctor: doctorObj
      },
      position: aheadCount + 1,
      estimatedWaitMinutes: Math.max(10, (aheadCount + 1) * 10)
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const arriveMyAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    const appointmentId = req.params.id || req.body.appointmentId;

    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    if (!appointmentId) {
      return res.status(400).json({ error: 'Bad Request', message: 'appointmentId is required' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { queueEntry: true }
    });

    if (!appointment || appointment.patientId !== patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'Appointment not found' });
    }

    const updatedAppt = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'ARRIVED' }
    });

    let queueEntry;
    if (appointment.queueEntry) {
      queueEntry = await prisma.queueEntry.update({
        where: { id: appointment.queueEntry.id },
        data: {
          status: 'WAITING',
          arrivalTime: new Date()
        }
      });
    } else {
      queueEntry = await prisma.queueEntry.create({
        data: {
          appointmentId,
          doctorId: appointment.doctorId,
          priority: 0,
          status: 'WAITING',
          arrivalTime: new Date()
        }
      });
    }

    const tokenNumber = `TK-2026-${(queueEntry.id.replace(/\D/g, '') || queueEntry.id.slice(-3)).padStart(3, '0').slice(-3)}`;
    const entryWithToken = { ...queueEntry, tokenNumber };

    broadcastQueueUpdate(appointment.facilityId, appointment.doctorId, entryWithToken, patientId);
    broadcastPatientUpdate(patientId, 'appointment.arrived', { appointmentId, queueEntry: entryWithToken });

    res.json({
      success: true,
      appointment: updatedAppt,
      queueEntry: entryWithToken
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMyFollowups = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.user?.patientId;
    if (!patientId) {
      return res.status(404).json({ error: 'Not Found', message: 'No patient record linked to this user' });
    }

    const followups = await prisma.followUp.findMany({
      where: { patientId },
      include: {
        worker: {
          include: {
            facility: true
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json(followups);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
