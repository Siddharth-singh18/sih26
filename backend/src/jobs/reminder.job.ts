import { prisma } from '../index';

// 29. REMINDERS & NOTIFICATIONS: Automated background job for sending SMS/Push reminders
export const sendAppointmentReminders = async () => {
  console.log('[Job] Starting appointment reminder job...');
  
  try {
    // Find appointments scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startOfTomorrow = new Date(tomorrow.setHours(0,0,0,0));
    const endOfTomorrow = new Date(tomorrow.setHours(23,59,59,999));

    const upcoming = await prisma.appointment.findMany({
      where: {
        scheduledAt: {
          gte: startOfTomorrow,
          lte: endOfTomorrow
        },
        status: 'BOOKED'
      },
      include: {
        patient: true
      }
    });

    for (const appt of upcoming) {
      if (appt.patient.phone) {
        console.log(`[Job] Sending SMS reminder to ${appt.patient.name} at ${appt.patient.phone}`);
        // Mocking an external SMS provider (e.g., Twilio, AWS SNS)
        // await smsProvider.send(appt.patient.phone, `Reminder: Appointment tomorrow.`);
      }
    }
  } catch (error) {
    console.error('[Job] Error sending reminders:', error);
  }
};
