import { Request, Response } from 'express';
import { prisma } from '../../index';
import { recordAuditLog } from '../audit/audit.service';

/**
 * OFFLINE SYNC MUTATION BATCH (PUSH)
 * Processes offline mutations queued by frontline mobile/web workers.
 * Enforces operationId idempotency to prevent duplicate mutations.
 */
export const processSyncBatch = async (req: Request, res: Response) => {
  try {
    const { workerId, mutations } = req.body;

    if (!Array.isArray(mutations)) {
      return res.status(400).json({ error: 'Mutations array is required' });
    }

    const results = [];

    for (const mutation of mutations) {
      const { operationId, entity, action, payload } = mutation;

      if (!operationId) {
        results.push({ operationId: 'UNKNOWN', status: 'ERROR', error: 'Missing operationId' });
        continue;
      }

      const existingOp = await prisma.syncOperation.findUnique({
        where: { id: operationId }
      });

      if (existingOp) {
        // Idempotent: already processed
        results.push({ operationId, status: 'ALREADY_SYNCED' });
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Stale Client Collision Conflict Detection
          let isConflict = false;
          let serverRecord: any = null;

          if (action === 'UPDATE' && payload.id) {
            if (entity === 'PATIENT') {
              serverRecord = await tx.patient.findUnique({ where: { id: payload.id } });
            } else if (entity === 'FOLLOWUP') {
              serverRecord = await tx.followUp.findUnique({ where: { id: payload.id } });
            } else if (entity === 'REFERRAL') {
              serverRecord = await tx.referral.findUnique({ where: { id: payload.id } });
            }

            if (serverRecord && mutation.timestamp) {
              const clientTime = new Date(mutation.timestamp).getTime();
              const serverTime = serverRecord.updatedAt ? new Date(serverRecord.updatedAt).getTime() : 0;
              // If server was modified after the client's snapshot timestamp
              if (serverTime > clientTime + 500) {
                isConflict = true;
              }
            }
          }

          if (isConflict) {
            await tx.syncOperation.create({
              data: {
                id: operationId,
                userId: workerId || 'unknown-worker',
                deviceId: mutation.deviceId || 'unknown',
                entity,
                entityId: payload.id || 'unknown',
                operation: action,
                payload: {
                  clientPayload: payload,
                  serverPayload: serverRecord
                },
                clientTimestamp: mutation.timestamp ? new Date(mutation.timestamp) : new Date(),
                status: 'CONFLICT'
              }
            });

            await recordAuditLog({
              userId: workerId || null,
              action: 'SYNC_CONFLICT_DETECTED',
              resource: entity,
              resourceId: payload.id || null
            }, tx);

            results.push({
              operationId,
              status: 'CONFLICT',
              conflict: {
                serverState: serverRecord,
                clientState: payload,
                reason: 'STALE_CLIENT_UPDATE'
              }
            });
            return;
          }

          if (entity === 'PATIENT') {
            if (action === 'CREATE') {
              await tx.patient.create({ data: payload });
            } else if (action === 'UPDATE') {
              await tx.patient.update({
                where: { id: payload.id },
                data: payload
              });
            }
          } else if (entity === 'ASSESSMENT') {
            if (action === 'CREATE') {
              await tx.assessment.create({ data: payload });
            }
          } else if (entity === 'REFERRAL') {
            if (action === 'CREATE') {
              await tx.referral.create({ data: payload });
            } else if (action === 'UPDATE') {
              await tx.referral.update({
                where: { id: payload.id },
                data: payload
              });
            }
          } else if (entity === 'FOLLOWUP') {
            if (action === 'UPDATE') {
              await tx.followUp.update({
                where: { id: payload.id },
                data: payload
              });
            }
          } else if (entity === 'TASK') {
            if (action === 'UPDATE') {
              await tx.task.update({
                where: { id: payload.id },
                data: payload
              });
            }
          }

          // Record sync audit record
          await tx.syncOperation.create({
            data: {
              id: operationId,
              userId: workerId || 'unknown-worker',
              deviceId: mutation.deviceId || 'unknown',
              entity,
              entityId: payload.id || 'unknown',
              operation: action,
              payload,
              clientTimestamp: mutation.timestamp ? new Date(mutation.timestamp) : new Date(),
              status: 'SUCCESS'
            }
          });

          await recordAuditLog({
            userId: workerId || null,
            action: `SYNC_${entity}_${action}`,
            resource: entity,
            resourceId: payload.id || null
          }, tx);

          results.push({ operationId, status: 'SUCCESS' });
        });
      } catch (err: any) {
        results.push({ operationId, status: 'FAILED', error: err.message });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Error processing sync batch:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * OFFLINE SYNC DELTA PULL
 * Returns records created or updated since the client's lastSyncTimestamp.
 * Optimized for low-bandwidth 2G/3G connections.
 */
export const pullSyncChanges = async (req: Request, res: Response) => {
  try {
    const sinceParam = req.query.since as string;
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const facilityId = req.query.facilityId as string | undefined;
    const workerId = (req as any).user?.id || (req.query.workerId as string | undefined);

    const [patients, referrals, followups, tasks, notifications] = await Promise.all([
      prisma.patient.findMany({
        where: { updatedAt: { gte: since } },
        take: 100,
        orderBy: { updatedAt: 'asc' }
      }),
      prisma.referral.findMany({
        where: {
          ...(facilityId ? {
            OR: [
              { originId: facilityId },
              { destinationId: facilityId }
            ]
          } : {})
        },
        include: { events: true },
        take: 100
      }),
      prisma.followUp.findMany({
        where: {
          ...(workerId ? { workerId } : {})
        },
        take: 100
      }),
      prisma.task.findMany({
        where: {
          ...(workerId ? { workerId } : {})
        },
        take: 100
      }),
      prisma.notification.findMany({
        where: {
          createdAt: { gte: since },
          ...(workerId ? { userId: workerId } : {})
        },
        take: 50,
        orderBy: { createdAt: 'asc' }
      })
    ]);

    res.json({
      syncTimestamp: new Date().toISOString(),
      since: since.toISOString(),
      delta: {
        patients,
        referrals,
        followups,
        tasks,
        notifications
      }
    });
  } catch (error: any) {
    console.error('Error pulling sync changes:', error);
    res.status(500).json({ error: 'Failed to pull sync updates' });
  }
};
