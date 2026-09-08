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

export const enqueueMutation = async (entity: string, action: string, payload: any) => {
  const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.mutationQueue.add({
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
