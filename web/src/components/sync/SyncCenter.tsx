
import { useState, useEffect } from 'react';
import { db, MutationQueueEntry } from '../../lib/db';
import { useSync } from '../../hooks/useSync';
import api from '../../lib/api';
import { Button } from '../ui/Button';
import { RefreshCw, Wifi, WifiOff, CheckCircle2, AlertTriangle, CloudUpload } from 'lucide-react';

export default function SyncCenter() {
  const { isOnline, syncing, pendingCount, syncData, updatePendingCount } = useSync();
  const [conflicts, setConflicts] = useState<MutationQueueEntry[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadConflicts = async () => {
    try {
      const conflictList = await db.mutationQueue.where('status').equals('CONFLICT').toArray();
      setConflicts(conflictList);
    } catch {
      setConflicts([]);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, [pendingCount, syncing]);

  const handleResolve = async (operationId: string, strategy: 'KEEP_SERVER' | 'OVERWRITE_SERVER' | 'MERGE', payload: any) => {
    setResolvingId(operationId);
    try {
      await api.post('/sync/conflict', {
        operationId,
        resolutionStrategy: strategy,
        resolvedPayload: payload
      });
      await db.mutationQueue.where('operationId').equals(operationId).modify({ status: 'SYNCED' });
      await loadConflicts();
      await updatePendingCount();
    } catch (err) {
      console.error('Failed to resolve sync conflict:', err);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            !isOnline ? 'bg-amber-100 text-amber-600' : pendingCount > 0 ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-[#1e6641]'
          }`}>
            {!isOnline ? <WifiOff size={16} /> : pendingCount > 0 ? <CloudUpload size={16} /> : <Wifi size={16} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              Offline Sync Status
              <span className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-[#1e6641]' : 'bg-amber-500'}`} />
            </h3>
            <p className="text-xs text-gray-500">
              {isOnline ? 'Connected to AyuSync Central Cloud' : 'Low-connectivity field mode (IndexedDB active)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conflicts.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
              {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {pendingCount} pending
            </span>
          )}
          <Button
            size="sm"
            onClick={syncData}
            disabled={syncing || !isOnline}
            className="bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>

      {/* Conflicts section */}
      {conflicts.length > 0 && (
        <div className="mt-4 space-y-3">
          {conflicts.map((c) => (
            <div key={c.operationId} className="p-4 border border-red-200 rounded-xl bg-red-50/40 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-red-800">
                <AlertTriangle size={14} className="text-red-600" />
                Data Collision Detected: {c.entity} Mutation ({c.operationId.slice(0, 8)})
              </div>
              <p className="text-xs text-gray-600">
                A server record was updated concurrently with your offline edits. Please select how to resolve:
              </p>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolvingId === c.operationId}
                  onClick={() => handleResolve(c.operationId, 'KEEP_SERVER', c.payload)}
                  className="text-xs"
                >
                  Keep Server Version
                </Button>
                <Button
                  size="sm"
                  disabled={resolvingId === c.operationId}
                  onClick={() => handleResolve(c.operationId, 'OVERWRITE_SERVER', c.payload)}
                  className="bg-[#1e6641] text-white text-xs hover:bg-[#165032]"
                >
                  Apply Frontline Edits
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolvingId === c.operationId}
                  onClick={() => handleResolve(c.operationId, 'MERGE', c.payload)}
                  className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  Non-Destructive Merge
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Synced confirmation banner */}
      {conflicts.length === 0 && pendingCount === 0 && (
        <div className="mt-3.5 flex items-center gap-2 text-xs font-medium text-[#1e6641] bg-[#e4efe7]/50 rounded-xl px-3.5 py-2">
          <CheckCircle2 size={14} />
          All local community registrations and assessment records are fully synchronized with the hospital database.
        </div>
      )}
    </div>
  );
}
