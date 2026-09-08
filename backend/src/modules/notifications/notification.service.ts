import { prisma } from '../../index';

export const createNotification = async (userId: string, type: string, message: string) => {
  try {
    const notif = await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        isRead: false
      }
    });
    return notif;
  } catch (err) {
    console.error('Failed to create notification', err);
  }
};
