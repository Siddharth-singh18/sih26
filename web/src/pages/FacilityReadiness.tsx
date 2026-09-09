import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import api, { getBaseServerUrl } from '../lib/api';
import { Button } from '../components/ui/Button';

export default function FacilityReadiness() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [urgentAlert, setUrgentAlert] = useState<{ summary: string; facilityId: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const fetchFacilities = async () => {
    try {
      setLoading(true);
      const res = await api.get('/facilities');
      setFacilities(res.data);
      setError('');
    } catch {
      setError('Failed to load facilities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacilities();

    // Part M: Connect Live Realtime Socket for Operational Intelligence
    const token = localStorage.getItem('ayusync_token');
    const socket = io(getBaseServerUrl(), {
      transports: ['websocket', 'polling'],
      auth: { token }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsRealtimeActive(true);
    });

    socket.on('disconnect', () => {
      setIsRealtimeActive(false);
    });

    // Realtime event listeners -> Invalidate and refetch PostgreSQL telemetry
    socket.on('FACILITY_AVAILABILITY_CHANGED', () => {
      fetchFacilities();
    });

    socket.on('FACILITY_CAPACITY_CHANGED', () => {
      fetchFacilities();
    });

    socket.on('QUEUE_LOAD_CHANGED', () => {
      fetchFacilities();
    });

    socket.on('URGENT_ESCALATION', (payload: any) => {
      setUrgentAlert({
        summary: payload.summary || 'Urgent clinical escalation received',
        facilityId: payload.facilityId
      });
      fetchFacilities();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // When facilities are loaded, join authorized facility rooms
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && facilities.length > 0) {
      facilities.forEach(fac => {
        socketRef.current?.emit('join:facility', fac.id);
      });
    }
  }, [facilities]);

  const updateAvailability = async (id: string, currentStatus: string, currentScore?: number) => {
    const newStatus = currentStatus === 'OPEN' ? 'OVERCAPACITY' : 'OPEN';
    setUpdating(id);
    setError('');
    try {
      await api.put(`/facilities/${id}/availability`, {
        status: newStatus,
        readinessScore: typeof currentScore === 'number' ? currentScore : 80
      });
      await fetchFacilities();
    } catch (e: any) {
      setError(e.response?.data?.error || e.response?.data?.message || 'Failed to update availability.');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      <div className="bg-white rounded-2xl p-6 border border-[#d5e0e3] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#5e6e39]">
            Dynamic Resource Availability
          </span>
          <h2 className="text-2xl font-black text-[#1c3024] tracking-tight mt-0.5">
            Facility Readiness Intelligence
          </h2>
          <p className="text-xs text-gray-500">
            Real-time telemetry on ICU beds, oxygen reserves, and specialist coverage across the district
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isRealtimeActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
            {isRealtimeActive ? 'Realtime Stream Active' : 'Connecting...'}
          </span>
          <Button variant="outline" onClick={fetchFacilities} className="border-[#d5e0e3] text-xs">
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {urgentAlert && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-2xl flex items-center justify-between text-xs animate-bounce">
          <div className="flex items-center gap-2">
            <span className="text-base">🚨</span>
            <span className="font-bold">CRITICAL OPERATIONAL ESCALATION:</span>
            <span>{urgentAlert.summary}</span>
          </div>
          <button
            onClick={() => setUrgentAlert(null)}
            className="text-red-600 hover:text-red-900 font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-xs">{error}</div>}

      {loading ? (
        <div className="text-gray-500 animate-pulse text-sm p-8 text-center bg-white rounded-2xl border">Loading facilities...</div>
      ) : facilities.length === 0 ? (
        <div className="text-gray-500 bg-white p-12 rounded-2xl text-center border border-[#d5e0e3]">No facilities found.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {facilities.map((fac) => {
            const avail = fac.availability;
            const status = avail?.status || 'OPEN';
            const isDanger = status === 'OVERCAPACITY' || status === 'CLOSED';

            return (
              <div 
                key={fac.id} 
                className={`rounded-2xl border bg-white shadow-sm p-6 border-t-4 transition-all hover:shadow-md ${
                  isDanger ? 'border-t-red-500' : 'border-t-[#2d6e4a]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Level {fac.level} • {fac.type}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isDanger ? 'bg-red-100 text-red-700' : 'bg-[#eaf2ec] text-[#2d6e4a]'
                  }`}>
                    {status}
                  </span>
                </div>

                <h3 className="font-extrabold text-lg text-[#1c3024] mb-3">{fac.name}</h3>

                <div className="space-y-2 text-xs mb-6 bg-[#f7f6ed] p-3 rounded-xl border border-[#d5e0e3]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Readiness Score:</span> 
                    <span className="font-bold text-[#2d6e4a]">{avail?.readinessScore != null ? `${avail.readinessScore}/100` : 'Not recorded'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Location:</span> 
                    <span className="font-medium text-[#1c3024]">{fac.address || 'Address not registered'}</span>
                  </div>
                </div>

                <Button
                  variant={isDanger ? 'outline' : 'default'}
                  className={`w-full text-xs font-bold ${isDanger ? '' : 'bg-[#2d6e4a] hover:bg-[#1e4d33] text-white'}`}
                  onClick={() => updateAvailability(fac.id, status, avail?.readinessScore)}
                  disabled={updating === fac.id}
                >
                  {updating === fac.id ? 'Updating...' : `Toggle to ${status === 'OPEN' ? 'OVERCAPACITY' : 'OPEN'}`}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
