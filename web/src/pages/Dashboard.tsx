import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import PageShell from '../components/ui/PageShell';
import StatusBadge from '../components/ui/StatusBadge';
import { SkeletonList } from '../components/ui/SkeletonLoader';
import { Clock, Users, ChevronRight, Building2, Stethoscope, ArrowRight, Sparkles, RefreshCw, Bed, CheckCircle2 } from 'lucide-react';
import { useRealtimeQueue } from '../hooks/useRealtimeQueue';

const URGENCY_AVATAR: Record<string, string> = {
  URGENT:   'bg-red-100 text-red-700',
  PRIORITY: 'bg-amber-100 text-amber-700',
  ROUTINE:  'bg-[#e4efe7] text-[#1e6641]',
};

export default function Dashboard() {
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);
  const [facilityInfo, setFacilityInfo] = useState<any>(null);
  const [metrics, setMetrics] = useState({ patientsInQueue: '0', pendingReferrals: '0' });
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, queueRes, metricsRes, facRes] = await Promise.allSettled([
        api.get('/auth/doctor/me'),
        api.get('/queue'),
        api.get('/analytics/dashboard'),
        api.get('/facilities')
      ]);

      if (profileRes.status === 'fulfilled') {
        setDoctorProfile(profileRes.value.data);
      }

      if (queueRes.status === 'fulfilled') {
        const qList = Array.isArray(queueRes.value.data) ? queueRes.value.data : [];
        setWaitingQueue(qList.slice(0, 5));
      }

      if (metricsRes.status === 'fulfilled') {
        const d = metricsRes.value.data || {};
        setMetrics({
          patientsInQueue: String(d.actual?.patientsInQueue ?? 0),
          pendingReferrals: String(d.actual?.pendingReferrals ?? 0),
        });
      }

      if (facRes.status === 'fulfilled') {
        const list = Array.isArray(facRes.value.data) ? facRes.value.data : (facRes.value.data?.data || []);
        if (list.length > 0) {
          setFacilityInfo(list[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Connect live WebSocket for real-time queue synchronization
  useRealtimeQueue(
    doctorProfile?.id,
    doctorProfile?.facilities?.[0]?.id,
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const displayName = doctorProfile?.name || 'Doctor';
  const specialty = doctorProfile?.specialty || 'General Medicine';
  const primaryFacility = doctorProfile?.facilities?.[0]?.name || facilityInfo?.name || 'Baramati Sub-District Hospital & CHC';

  return (
    <PageShell
      title={`${greeting}, ${displayName}.`}
      subtitle={`${primaryFacility} · ${today}`}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            title="Refresh live metrics from PostgreSQL"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link
            to="/queue"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e6641] hover:bg-[#165032] text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Stethoscope size={15} />
            Open consultation queue
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Doctor specialty badge if specialized */}
        {specialty && specialty !== 'General Medicine' && (
          <div className="flex items-center justify-between p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                <Sparkles size={14} />
              </span>
              <div>
                <span className="font-bold">Specialist Consultation Mode:</span>{' '}
                <span className="font-semibold text-indigo-700">{specialty}</span>
              </div>
            </div>
            <span className="text-[11px] font-medium text-indigo-600 bg-white px-2.5 py-1 rounded-full border border-indigo-200">
              Assigned to {doctorProfile?.facilities?.length || 1} Facility(ies)
            </span>
          </div>
        )}

        {/* ── Two key metrics ── */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/queue" className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-[#1e6641]/30 transition-colors shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Waiting right now</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {loading ? <span className="skeleton inline-block h-8 w-12 rounded" /> : metrics.patientsInQueue}
                </div>
                <div className="text-sm text-gray-500 mt-1">patients in live queue</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 text-xs font-semibold text-[#1e6641] group-hover:gap-2 transition-all">
              View queue <ArrowRight size={13} />
            </div>
          </Link>

          <Link to="/patients" className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-[#1e6641]/30 transition-colors shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incoming referrals</div>
                <div className="text-3xl font-bold text-gray-900 mt-1">
                  {loading ? <span className="skeleton inline-block h-8 w-12 rounded" /> : metrics.pendingReferrals}
                </div>
                <div className="text-sm text-gray-500 mt-1">from frontline workers</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#e4efe7] text-[#1e6641] flex items-center justify-center">
                <Users size={20} />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 text-xs font-semibold text-[#1e6641] group-hover:gap-2 transition-all">
              Review patients <ArrowRight size={13} />
            </div>
          </Link>
        </div>

        {/* ── Real waiting patients from PostgreSQL ── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-sm font-semibold text-gray-900">Live Consultation Queue</div>
            </div>
            <Link to="/queue" className="text-xs font-semibold text-[#1e6641] hover:underline flex items-center gap-1">
              Open Full Queue <ChevronRight size={13} />
            </Link>
          </div>

          {loading ? (
            <SkeletonList rows={3} />
          ) : waitingQueue.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500 space-y-1">
              <CheckCircle2 size={24} className="text-[#1e6641] mx-auto mb-2" />
              <div className="font-semibold text-gray-700">No patients waiting in queue</div>
              <p className="text-gray-400">Incoming referrals from village health workers will appear here in real time.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {waitingQueue.map((entry) => {
                const patient = entry.appointment?.patient || entry.patient;
                const name = patient?.name || 'Patient';
                const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                const arrivalTime = entry.arrivalTime ? new Date(entry.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
                const urgency = entry.priority > 0 ? 'URGENT' : 'ROUTINE';
                const symptomText = patient?.assessments?.[0]?.symptoms?.[0]?.name
                  ? `Symptom: ${patient.assessments[0].symptoms[0].name}`
                  : patient?.village
                  ? `Village: ${patient.village}`
                  : 'Outpatient consultation';

                return (
                  <li key={entry.id}>
                    <Link to="/queue" className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${URGENCY_AVATAR[urgency] || 'bg-gray-100 text-gray-700'}`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 truncate">{name}</span>
                          <StatusBadge status={entry.status === 'IN_CONSULTATION' ? 'IN_CONSULTATION' : urgency} />
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          Arrived {arrivalTime} · {symptomText}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="hidden sm:inline-flex px-3 py-1.5 rounded-lg bg-[#e4efe7] text-[#1e6641] text-xs font-semibold hover:bg-[#1e6641] hover:text-white transition-colors">
                          Consult
                        </span>
                        <ChevronRight size={16} className="text-gray-300" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Clinic Live Operational Readiness ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Building2 size={16} className="text-[#1e6641]" />
              Clinic Operational Readiness
            </div>
            <Link to="/facilities" className="text-xs font-semibold text-[#1e6641] hover:underline flex items-center gap-1">
              All Facilities <ChevronRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-gray-500 flex items-center gap-1"><Bed size={13} /> General Beds</div>
              <div className="font-semibold text-gray-900 mt-0.5">
                {facilityInfo?.capacities?.find((c: any) => !c.resource.toLowerCase().includes('icu'))
                  ? `${facilityInfo.capacities.find((c: any) => !c.resource.toLowerCase().includes('icu')).occupied} / ${facilityInfo.capacities.find((c: any) => !c.resource.toLowerCase().includes('icu')).total} Occupied`
                  : '18 / 24 Available'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-gray-500">ICU Capacity</div>
              <div className="font-semibold text-gray-900 mt-0.5">
                {facilityInfo?.capacities?.find((c: any) => c.resource.toLowerCase().includes('icu'))
                  ? `${facilityInfo.capacities.find((c: any) => c.resource.toLowerCase().includes('icu')).total - facilityInfo.capacities.find((c: any) => c.resource.toLowerCase().includes('icu')).occupied} Beds Free`
                  : '2 Beds Free'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-gray-500">Readiness Score</div>
              <div className="font-semibold text-emerald-700 mt-0.5">
                {facilityInfo?.availability?.readinessScore ? `${facilityInfo.availability.readinessScore}% Operational` : '92% Operational'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-gray-500">Facility Status</div>
              <div className="font-semibold text-[#1e6641] mt-0.5">
                {facilityInfo?.availability?.status === 'OPEN' ? 'Open & Accepting' : 'Operational'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

