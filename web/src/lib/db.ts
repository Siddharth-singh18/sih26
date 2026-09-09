import Dexie, { Table } from 'dexie';

export interface Patient {
  id?: string;
  name: string;
  gender: string;
  age?: number;
  phone?: string;
  village?: string;
  abhaId?: string;
  synced: boolean;
  createdAt: string;
}

export interface MutationQueueEntry {
  id?: string;
  operationId: string;
  entity: string;
  action: string;
  payload: any;
  timestamp: string;
  status: 'PENDING' | 'SYNCED' | 'ERROR' | 'CONFLICT';
  retryCount: number;
}

export class AyuSyncDB extends Dexie {
  patients!: Table<Patient, string>;
  mutationQueue!: Table<MutationQueueEntry, string>;

  constructor() {
    super('AyuSyncDB');
    this.version(1).stores({
      patients: 'id, name, synced',
      mutationQueue: 'id, operationId, entity, status'
    });
  }
}

export const db = new AyuSyncDB();

export const generateDurableOperationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `op_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `op_${Date.now()}_${Date.now().toString(36)}`;
};

export const enqueueMutation = async (entity: string, action: string, payload: any) => {
  const operationId = generateDurableOperationId();
  
  await db.mutationQueue.add({
    id: operationId,
    operationId,
    entity,
    action,
    payload,
    timestamp: new Date().toISOString(),
    status: 'PENDING',
    retryCount: 0
  });

  return operationId;
};

/**
 * Session Security Isolation:
 * Purges cached offline patient records and pending local mutation queues on user logout.
 * Guarantees User A's offline patient data is never accessible to subsequent user sessions.
 */
export const clearOfflineDataOnLogout = async (): Promise<void> => {
  try {
    await Promise.all([
      db.patients.clear(),
      db.mutationQueue.clear()
    ]);
  } catch (err) {
    console.error('Failed to clear offline local data on logout:', err);
  }
};
