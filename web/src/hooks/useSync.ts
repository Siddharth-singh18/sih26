import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import api from '../lib/api';

export function useSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const updatePendingCount = async () => {
    const count = await db.mutationQueue.where('status').equals('PENDING').count();
    setPendingCount(count);
  };

  const syncData = async () => {
    if (syncing || !isOnline) return;
    
    setSyncing(true);
    try {
      const pendingMutations = await db.mutationQueue.where('status').equals('PENDING').toArray();
      if (pendingMutations.length === 0) {
        setSyncing(false);
        return;
      }

      const user = JSON.parse(localStorage.getItem('ayusync_user') || '{}');
      const workerId = user.workerId || user.id || 'worker-sunita-patil';

      const response = await api.post('/sync', {
        workerId,
        mutations: pendingMutations
      });

      const { results } = response.data;
      
      // Process results
      for (const res of results) {
        if (res.status === 'SUCCESS' || res.status === 'ALREADY_SYNCED') {
          await db.mutationQueue.update(res.operationId, { status: 'SYNCED' });
        } else if (res.status === 'CONFLICT') {
          await db.mutationQueue.update(res.operationId, { status: 'CONFLICT' });
        } else {
          await db.mutationQueue.update(res.operationId, { status: 'ERROR', retryCount: 1 });
        }
      }
      
      await updatePendingCount();
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    updatePendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      syncData();
    }
  }, [isOnline]);

  return {
    isOnline,
    syncing,
    pendingCount,
    syncData,
    updatePendingCount
  };
}
