import cron from 'node-cron';
import { prisma } from '../index';
import { createNotification } from '../modules/notifications/notification.service';

export const startJobs = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running care-gap detection job...');
    
    try {
      // 1. Detect stuck referrals (SUBMITTED for > 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const stuckReferrals = await prisma.referral.findMany({
        where: {
          status: 'SUBMITTED',
          events: {
            some: {
              statusTo: 'SUBMITTED',
              createdAt: { lt: yesterday }
            }
          }
        }
      });

      for (const ref of stuckReferrals) {
        // Create an escalation task
        await prisma.task.create({
          data: {
            type: 'CARE_GAP',
            status: 'PENDING',
            priority: 'HIGH',
            dueDate: new Date(),
            // Assigning to a generic worker or facility admin in real system
            workerId: null 
          }
        });
        
        console.log(`Care Gap: Escalated stuck referral ${ref.id}`);
      }

      // 2. Detect overdue follow-ups
      const overdueFollowUps = await prisma.followUp.findMany({
        where: {
          status: 'PENDING',
          dueDate: { lt: new Date() }
        }
      });

      for (const fu of overdueFollowUps) {
        await prisma.followUp.update({
          where: { id: fu.id },
          data: { status: 'OVERDUE' }
        });
        
        // Ensure a task exists for this overdue followup
        await prisma.task.create({
          data: {
            type: 'CARE_GAP',
            status: 'PENDING',
            priority: 'HIGH',
            workerId: fu.workerId
          }
        });

        if (fu.workerId) {
          const worker = await prisma.worker.findUnique({ where: { id: fu.workerId }});
          if (worker) {
            await createNotification(worker.userId, 'CARE_GAP_ALERT', `Patient followup ${fu.id} is OVERDUE.`);
          }
        }
        
        console.log(`Care Gap: Marked followup ${fu.id} as OVERDUE`);
      }

    } catch (err) {
      console.error('Error in care-gap detection job:', err);
    }
  });

  console.log('Background jobs scheduled.');
};
