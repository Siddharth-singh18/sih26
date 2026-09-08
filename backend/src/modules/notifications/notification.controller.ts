import { Request, Response } from 'express';
import { prisma } from '../../index';
import { getIO } from '../../events/socket';

export const createNotificationHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { type = 'GENERAL', message, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const targetUserId = userId || user?.id;
    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID is required for notification' });
    }

    const notif = await prisma.notification.create({
      data: {
        userId: targetUserId,
        type,
        message,
        isRead: false
      }
    });

    // Broadcast in real time via Socket.io
    try {
      const io = getIO();
      io.emit('notification:new', notif);
      if (type === 'CARE_GAP_ESCALATION') {
        io.emit('care_gap:escalated', notif);
      }
    } catch {
      // Non-blocking
    }

    res.status(201).json(notif);
  } catch (error: any) {
    console.error('[Notification] create error:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getNotificationsHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;

    const notifications = await prisma.notification.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(notifications);
  } catch (error: any) {
    console.error('[Notification] list error:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
