import { PrismaClient } from '@prisma/client';
import { getIO } from '../../events/socket';

const prisma = new PrismaClient();

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

    // Deliver via Socket.io to user's private room
    try {
      getIO().to(`user_${userId}`).emit('notification:new', notif);
    } catch {
      // Non-blocking
    }

    return notif;
  } catch (err) {
    console.error('Failed to create notification', err);
  }
};
