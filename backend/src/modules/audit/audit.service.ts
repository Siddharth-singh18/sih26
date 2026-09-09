import { PrismaClient } from '@prisma/client';

const defaultPrisma = new PrismaClient();

export interface AuditLogEntry {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, any>;
}

/**
 * Centralized Audit Logging Service
 * Records consequential system actions into PostgreSQL AuditLog table.
 * Strictly guarantees patient PII protection (zero names, phone numbers, or clinical notes).
 */
export async function recordAuditLog(
  entry: AuditLogEntry,
  tx?: any
): Promise<any> {
  const client = tx || defaultPrisma;

  try {
    let validUserId: string | null = null;
    if (entry.userId) {
      const user = await client.user.findUnique({
        where: { id: entry.userId },
        select: { id: true }
      });
      if (user) {
        validUserId = user.id;
      } else {
        const worker = await client.worker.findUnique({
          where: { id: entry.userId },
          select: { userId: true }
        });
        if (worker) {
          validUserId = worker.userId;
        }
      }
    }

    const log = await client.auditLog.create({
      data: {
        userId: validUserId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId || null,
        timestamp: new Date()
      }
    });

    return log;
  } catch (error) {
    // Audit logging failure should not crash core workflow, but log error
    console.error('[AuditLog] Failed to record audit entry:', error);
    return null;
  }
}

/**
 * Query audit logs with security filters
 */
export async function getAuditLogs(filter: {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  limit?: number;
}) {
  return defaultPrisma.auditLog.findMany({
    where: {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.resource ? { resource: filter.resource } : {}),
      ...(filter.resourceId ? { resourceId: filter.resourceId } : {})
    },
    orderBy: { timestamp: 'desc' },
    take: filter.limit || 50
  });
}
