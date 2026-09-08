import { Request, Response } from 'express';
import { prisma } from '../../index';
import { formatDoctorName } from '../patients/patient.controller';

export const bookAppointment = async (req: Request, res: Response) => {
  try {
    const { patientId, facilityId, doctorId, scheduledAt } = req.body;

    if (!patientId || !facilityId || !doctorId || !scheduledAt) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    const parsedDate = new Date(scheduledAt);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid scheduledAt date format' });
    }

    const nowMinus24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (parsedDate < nowMinus24h) {
      return res.status(400).json({ error: 'Bad Request', message: 'Appointment cannot be scheduled in the past' });
    }

    // 1. Validate entities exist
    const [patient, doctor, facility] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.doctor.findUnique({ where: { id: doctorId } }),
      prisma.facility.findUnique({ where: { id: facilityId }, include: { availability: true } })
    ]);

    if (!patient) return res.status(404).json({ error: 'Not Found', message: 'Patient not found' });
    if (!doctor) return res.status(404).json({ error: 'Not Found', message: 'Doctor not found' });
    if (!facility) return res.status(404).json({ error: 'Not Found', message: 'Facility not found' });

    // 2. Check facility availability
    if (facility.availability && facility.availability.status === 'CLOSED') {
      return res.status(409).json({ error: 'Conflict', message: 'Facility is currently closed' });
    }

    // 3. Check for doctor conflicts (exactly at the same time)
    const existingDoctorAppt = await prisma.appointment.findFirst({
      where: {
        doctorId,
        scheduledAt: parsedDate,
        status: { not: 'CANCELLED' }
      }
    });

    if (existingDoctorAppt) {
      return res.status(409).json({ error: 'Conflict', message: 'Doctor is already booked at this time' });
    }

    // 4. Check for patient conflicts (exactly at the same time)
    const existingPatientAppt = await prisma.appointment.findFirst({
      where: {
        patientId,
        scheduledAt: parsedDate,
        status: { not: 'CANCELLED' }
      }
    });

    if (existingPatientAppt) {
      return res.status(409).json({ error: 'Conflict', message: 'Patient already has an appointment at this time' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        facilityId,
        doctorId,
        scheduledAt: parsedDate,
        status: 'BOOKED'
      }
    });

    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getAllAppointments = async (req: Request, res: Response) => {
  try {
    const appointments = await prisma.appointment.findMany({
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        facility: true
      }
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getAppointmentAvailability = async (req: Request, res: Response) => {
  try {
    const { facilityId, doctorId, date } = req.query;

    if (!facilityId || typeof facilityId !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'facilityId query parameter is required' });
    }

    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      include: {
        availability: true,
        doctors: {
          include: {
            doctor: {
              include: {
                specialist: true,
                user: { select: { email: true, phone: true } }
              }
            }
          }
        }
      }
    });

    if (!facility) {
      return res.status(404).json({ error: 'Not Found', message: 'Facility not found' });
    }

    const isFacilityOpen = facility.availability?.status !== 'CLOSED';

    // Available doctors at this facility
    const facilityDoctors = facility.doctors.map((fd) => {
      const doc = fd.doctor;
      return {
        id: doc.id,
        name: formatDoctorName(doc),
        specialty: doc.specialist?.specialty || 'General Medicine'
      };
    });

    // Determine target doctor
    let selectedDoctorId = typeof doctorId === 'string' && doctorId ? doctorId : undefined;
    if (!selectedDoctorId && facilityDoctors.length > 0) {
      selectedDoctorId = facilityDoctors[0].id;
    }

    let selectedDoctor = selectedDoctorId
      ? facilityDoctors.find((d) => d.id === selectedDoctorId) || null
      : null;

    if (!selectedDoctor && selectedDoctorId) {
      const doc = await prisma.doctor.findUnique({
        where: { id: selectedDoctorId },
        include: {
          specialist: true,
          user: { select: { email: true, phone: true } }
        }
      });
      if (doc) {
        selectedDoctor = {
          id: doc.id,
          name: formatDoctorName(doc),
          specialty: doc.specialist?.specialty || 'General Medicine'
        };
      }
    }

    const targetDateStr = typeof date === 'string' && date ? date : new Date().toISOString().split('T')[0];
    const targetDate = new Date(targetDateStr);

    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid date parameter' });
    }

    // Standard clinic time slots
    const STANDARD_SLOTS = [
      '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
      '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM'
    ];

    // Query booked appointments for this doctor on targetDate
    const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

    const existingAppointments = selectedDoctorId ? await prisma.appointment.findMany({
      where: {
        doctorId: selectedDoctorId,
        scheduledAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['SCHEDULED', 'BOOKED', 'ARRIVED', 'IN_CONSULTATION'] }
      }
    }) : [];

    const bookedTimes = new Set(
      existingAppointments.map((a) => {
        return a.scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      })
    );

    const now = new Date();
    const isToday = targetDateStr === now.toISOString().split('T')[0];

    const slots = STANDARD_SLOTS.map((slot) => {
      const isBooked = bookedTimes.has(slot);
      let available = !isBooked && isFacilityOpen;
      let reason: string | undefined = undefined;

      if (!isFacilityOpen) {
        reason = 'Facility is closed';
      } else if (isBooked) {
        reason = 'Slot already booked';
      } else if (isToday) {
        const slotDate = new Date(`${targetDateStr} ${slot}`);
        if (!isNaN(slotDate.getTime()) && slotDate < now) {
          available = false;
          reason = 'Time slot passed';
        }
      }

      return {
        timeSlot: slot,
        available,
        reason
      };
    });

    res.json({
      facilityId: facility.id,
      facilityName: facility.name,
      isFacilityOpen,
      date: targetDateStr,
      doctor: selectedDoctor,
      facilityDoctors,
      slots,
      availableSlotsCount: slots.filter((s) => s.available).length,
      totalSlotsCount: slots.length
    });
  } catch (error) {
    console.error('Error fetching appointment availability:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
