import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api, { getBaseServerUrl } from '../lib/api';
import PageShell from '../components/ui/PageShell';
import { SkeletonList } from '../components/ui/SkeletonLoader';
import InlineError from '../components/ui/InlineError';
import EmptyState from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import SyncCenter from '../components/sync/SyncCenter';
import { useSync } from '../hooks/useSync';
import {
  UserPlus, ChevronRight, AlertTriangle,
  Wifi, WifiOff, RefreshCw, Users, Clock,
  ClipboardList, CheckCircle2, Pill, Search, MapPin,
  X
} from 'lucide-react';

const LABEL = 'block text-xs font-semibold text-gray-700 mb-1.5';
const INPUT = 'w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e6641]';

interface FollowUpTask {
  id: string;
  patientId: string;
  workerId?: string;
  dueDate: string;
  reason: string;
  notes?: string;
  status: string;
  completedAt?: string;
  patient?: {
    id: string;
    name: string;
    age?: number;
    gender?: string;
    village?: string;
    phone?: string;
  };
}

interface CommunityPatient {
  id: string;
  name: string;
  age?: number;
  gender: string;
  village?: string;
  phone?: string;
  createdAt: string;
  encounters?: { id: string; type: string; start: string }[];
}

export default function WorkerDashboard() {
  const user = JSON.parse(localStorage.getItem('ayusync_user') || '{}');
  const navigate = useNavigate();

  const [followUps, setFollowUps] = useState<FollowUpTask[]>([]);
  const [patients, setPatients] = useState<CommunityPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [showSyncCenter, setShowSyncCenter] = useState(false);
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set());

  // Task completion modal
  const [completingTask, setCompletingTask] = useState<FollowUpTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  const { isOnline, pendingCount } = useSync();
  const socketRef = useRef<Socket | null>(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = user.name || 'Sunita Patil';

  // ── Fetch Real Data from PostgreSQL ──
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [fuRes, patRes] = await Promise.all([
        api.get('/followups'),
        api.get(`/patients/search?q=${encodeURIComponent(patientSearch)}${villageFilter ? `&village=${encodeURIComponent(villageFilter)}` : ''}`)
      ]);

      const fuList = Array.isArray(fuRes.data) ? fuRes.data : [];
      const patList = Array.isArray(patRes.data) ? patRes.data : [];

      setFollowUps(fuList);
      setPatients(patList.slice(0, 10));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to load live worker records. Please check connection.');
      setFollowUps([]);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [patientSearch, villageFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Socket.io Realtime Subscriptions ──
  useEffect(() => {
    const workerId = user.workerId || user.id;
    if (!workerId) return;

    const serverUrl = getBaseServerUrl();
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('ayusync_token') }
    });

    socket.on('connect', () => {
      socket.emit('join:worker', workerId);
    });

    // When doctor creates counter-referral with new tasks
    socket.on('counter_referral:created', (payload: any) => {
      const incoming: any[] = payload.followUps || [];
      if (incoming.length === 0) return;

      setFollowUps(prev => {
        const existingIds = new Set(prev.map(f => f.id));
        const fresh = incoming.filter((f: any) => !existingIds.has(f.id));
        if (fresh.length === 0) return prev;

        setNewTaskIds(ids => {
          const s = new Set(ids);
          fresh.forEach(f => s.add(f.id));
          return s;
        });
        setTimeout(() => {
          setNewTaskIds(ids => {
            const s = new Set(ids);
            fresh.forEach(f => s.delete(f.id));
            return s;
          });
        }, 5000);

        return [...fresh, ...prev];
      });
    });

    // When a task is completed
    socket.on('followup:completed', (updatedTask: any) => {
      setFollowUps(prev => prev.map(f => f.id === updatedTask.id ? { ...f, status: 'COMPLETED', completedAt: updatedTask.completedAt } : f));
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, [user.id, user.workerId]);

  // Handle task completion submit
  const handleConfirmCompletion = async () => {
    if (!completingTask) return;
    setIsSubmittingCompletion(true);
    try {
      await api.patch(`/followups/${completingTask.id}/complete`, {
        completionNotes: completionNotes.trim() || 'Completed verified home visit'
      });

      setFollowUps(prev => prev.map(f => f.id === completingTask.id ? { ...f, status: 'COMPLETED' } : f));
      setCompletingTask(null);
      setCompletionNotes('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to complete task.');
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  // Categorize Tasks
  const now = new Date();
  const overdueTasks = followUps.filter(f => f.status === 'OVERDUE' || (f.status === 'PENDING' && f.dueDate && new Date(f.dueDate) < now));
  const pendingTasks = followUps.filter(f => f.status === 'PENDING' && (!f.dueDate || new Date(f.dueDate) >= now));
  const completedTasks = followUps.filter(f => f.status === 'COMPLETED');

  const tasksTotal = followUps.length;
  const tasksDone = completedTasks.length;
  const taskPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  // Unique villages for filter
  const villages = Array.from(new Set(patients.map(p => p.village).filter(Boolean))) as string[];

  return (
    <PageShell
      title={`${greeting}, ${name.split(' ')[0]}.`}
      subtitle="Khandala Sub-Center · Frontline Healthcare Care Control Center"
      action={
        <div className="flex items-center gap-2 flex-wrap">
          {/* Offline / Online indicator */}
          <button
            onClick={() => setShowSyncCenter(prev => !prev)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              !isOnline
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : pendingCount > 0
                ? 'border-blue-300 bg-blue-50 text-blue-800'
                : 'border-[#1e6641]/30 bg-[#e4efe7] text-[#1e6641]'
            }`}
          >
            {!isOnline ? (
              <>
                <WifiOff size={13} className="text-amber-600" />
                <span>Field Offline ({pendingCount} queued)</span>
              </>
            ) : pendingCount > 0 ? (
              <>
                <RefreshCw size={13} className="text-blue-600 animate-spin" />
                <span>Sync Pending ({pendingCount})</span>
              </>
            ) : (
              <>
                <Wifi size={13} className="text-[#1e6641]" />
                <span>Cloud Synced</span>
              </>
            )}
          </button>

          {/* Quick Intake Button */}
          <Link
            to="/intake"
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#1e6641] hover:bg-[#165032] text-white transition-colors shadow-xs"
          >
            <UserPlus size={13} />
            <span>Record Visit / Refer</span>
          </Link>
        </div>
      }
    >
      <InlineError message={error} onDismiss={() => setError('')} />

      {/* Sync Center Drawer / Dropdown */}
      {showSyncCenter && (
        <div className="animate-page-in mb-5">
          <SyncCenter />
        </div>
      )}

      <div className="space-y-6">
        {/* ── 1. TODAY'S PRIORITIES & OVERDUE ALERT ── */}
        {overdueTasks.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="text-sm font-bold text-red-900">
                  {overdueTasks.length} Urgent Overdue Care-Gap Follow-up{overdueTasks.length > 1 ? 's' : ''}
                </div>
                <div className="text-xs text-red-700 mt-0.5">
                  High-risk maternal and chronic patients requiring urgent in-person verification. Automatic escalation after 48h.
                </div>
              </div>
            </div>
            <button
              onClick={() => document.getElementById('task-inbox')?.scrollIntoView({ behavior: 'smooth' })}
              className="shrink-0 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors text-center"
            >
              Review Overdue Tasks
            </button>
          </div>
        )}

        {/* ── 2. QUICK METRICS & ACTION ROW ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Daily Task Completion</div>
                <div className="text-2xl font-bold text-gray-900 mt-0.5">
                  {tasksDone} <span className="text-sm font-normal text-gray-400">of {tasksTotal} assigned follow-ups complete</span>
                </div>
              </div>
              <span className="text-xs font-bold text-[#1e6641] bg-[#e4efe7] px-2.5 py-1 rounded-full">
                {taskPct}% Target Met
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1e6641] rounded-full transition-all duration-500"
                style={{ width: `${taskPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[11px] text-gray-400 font-medium">
              <span>{pendingTasks.length} pending today</span>
              <span>{overdueTasks.length} overdue</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to="/intake"
              className="flex items-center gap-3 bg-[#1e6641] hover:bg-[#165032] text-white rounded-2xl p-4 transition-all shadow-xs group"
            >
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <UserPlus size={18} />
              </div>
              <div>
                <div className="text-sm font-bold">Assisted Registration</div>
                <div className="text-xs text-white/70">Record vitals & triage visit</div>
              </div>
              <ChevronRight size={16} className="ml-auto text-white/50 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              to="/followups"
              className="flex items-center gap-3 bg-white hover:bg-gray-50 border border-gray-100 text-gray-900 rounded-2xl p-4 transition-all shadow-xs group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#e4efe7] text-[#1e6641] flex items-center justify-center shrink-0">
                <ClipboardList size={18} />
              </div>
              <div>
                <div className="text-sm font-bold">Care-Gap Continuity</div>
                <div className="text-xs text-gray-500">View all district tasks</div>
              </div>
              <ChevronRight size={16} className="ml-auto text-gray-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* ── 3. TASK INBOX (The Counter-Referral Loop) ── */}
        <div id="task-inbox" className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <ClipboardList size={16} className="text-[#1e6641]" />
              Frontline Task Inbox
              {pendingTasks.length + overdueTasks.length > 0 && (
                <span className="ml-1 text-xs font-bold bg-[#1e6641] text-white rounded-full px-2 py-0.5">
                  {pendingTasks.length + overdueTasks.length}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              Specialist instructions & post-consultation continuity tasks
            </span>
          </div>

          {loading ? (
            <SkeletonList rows={3} />
          ) : followUps.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No tasks assigned"
              description="When hospital doctors complete a consultation and issue counter-referral instructions, tasks will appear here in real time."
            />
          ) : (
            <ul className="divide-y divide-gray-50">
              {/* Overdue Tasks First */}
              {overdueTasks.map(task => {
                const isNew = newTaskIds.has(task.id);
                return (
                  <li
                    key={task.id}
                    className={`flex items-start gap-3.5 px-5 py-4 transition-all bg-red-50/30 ${
                      isNew ? 'bg-indigo-50 animate-pulse-once' : ''
                    }`}
                  >
                    <div className="mt-0.5 w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 font-bold text-xs">
                      !
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">{task.reason}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                          OVERDUE
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">{task.patient?.name || 'Patient'}</span>
                        {task.patient?.village && <span>· {task.patient.village}</span>}
                        {task.dueDate && (
                          <span className="text-red-600 font-medium">
                            · Due {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {task.notes && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1.5 bg-white/80 p-2 rounded-lg border border-gray-100">
                          <Pill size={12} className="text-[#1e6641] shrink-0" />
                          <span className="truncate">{task.notes}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <button
                        onClick={() => setCompletingTask(task)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                      >
                        Complete Visit
                      </button>
                    </div>
                  </li>
                );
              })}

              {/* Pending Routine Tasks */}
              {pendingTasks.map(task => {
                const isNew = newTaskIds.has(task.id);
                return (
                  <li
                    key={task.id}
                    className={`flex items-start gap-3.5 px-5 py-4 transition-all hover:bg-gray-50/50 ${
                      isNew ? 'bg-indigo-50 animate-pulse-once' : ''
                    }`}
                  >
                    <div className="mt-0.5 w-8 h-8 rounded-xl bg-[#e4efe7] text-[#1e6641] flex items-center justify-center shrink-0">
                      <Clock size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900">{task.reason}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">{task.patient?.name || 'Patient'}</span>
                        {task.patient?.village && <span>· {task.patient.village}</span>}
                        {task.dueDate && (
                          <span>· Due {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        )}
                      </div>
                      {task.notes && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5">
                          <Pill size={11} className="text-[#1e6641] shrink-0" />
                          <span className="truncate">{task.notes}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <button
                        onClick={() => setCompletingTask(task)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1e6641] hover:bg-[#165032] text-white transition-colors"
                      >
                        Verify & Complete
                      </button>
                    </div>
                  </li>
                );
              })}

              {/* Completed Tasks Accordion / Section */}
              {completedTasks.length > 0 && (
                <>
                  <li className="px-5 py-2.5 bg-gray-50/80 border-t border-b border-gray-100">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Recently Completed ({completedTasks.length})
                    </span>
                  </li>
                  {completedTasks.slice(0, 3).map(task => (
                    <li key={task.id} className="flex items-center gap-3.5 px-5 py-3 opacity-60">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-900 truncate">{task.reason}</div>
                        <div className="text-[11px] text-gray-500">
                          {task.patient?.name} · Completed {task.completedAt ? new Date(task.completedAt).toLocaleDateString('en-IN') : 'Recently'}
                        </div>
                      </div>
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}
        </div>

        {/* ── 4. MY COMMUNITY PATIENTS ── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Users size={16} className="text-[#1e6641]" />
                Community Health Registry
              </h2>
              <p className="text-xs text-gray-500">Patients registered in your sub-center jurisdiction</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Search name, phone..."
                  className="text-xs border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e6641]"
                />
              </div>

              {villages.length > 0 && (
                <select
                  value={villageFilter}
                  onChange={e => setVillageFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 bg-gray-50 text-gray-700"
                >
                  <option value="">All Villages</option>
                  {villages.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {loading ? (
            <SkeletonList rows={4} />
          ) : patients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No patients found"
              description="No community records match your search criteria. Tap 'Record Visit / Refer' to register a patient."
            />
          ) : (
            <div className="divide-y divide-gray-50">
              {patients.map(p => (
                <div
                  key={p.id}
                  className="p-4 hover:bg-gray-50/50 transition-colors flex items-center justify-between flex-wrap gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#e4efe7] text-[#1e6641] flex items-center justify-center font-bold text-sm shrink-0">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                        <span>{p.age || '--'} yrs</span>
                        <span>·</span>
                        <span>{p.gender}</span>
                        {p.village && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <MapPin size={10} className="text-gray-400" />
                              {p.village}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/patients/${p.id}`}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-semibold transition-colors"
                    >
                      View Profile
                    </Link>
                    <button
                      onClick={() => navigate(`/intake?step=2`)}
                      className="px-3 py-1.5 rounded-lg bg-[#e4efe7] text-[#1e6641] hover:bg-[#d5e7db] text-xs font-semibold transition-colors"
                    >
                      Field Visit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. TASK COMPLETION MODAL ── */}
      {completingTask && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4 animate-page-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#1e6641]" />
                <h3 className="text-base font-bold text-gray-900">Complete Follow-up Visit</h3>
              </div>
              <button
                onClick={() => setCompletingTask(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-gray-900">{completingTask.reason}</div>
              <div className="text-gray-600">
                Patient: <strong>{completingTask.patient?.name}</strong> ({completingTask.patient?.village || 'Community'})
              </div>
              {completingTask.notes && (
                <div className="text-gray-500 italic mt-1">{completingTask.notes}</div>
              )}
            </div>

            <div>
              <label className={LABEL}>Clinical Visit Notes & Patient Observations</label>
              <textarea
                rows={3}
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                placeholder="e.g. Conducted home visit. Blood pressure recorded at 126/82 mmHg. Patient confirmed taking prescribed medication daily..."
                className={INPUT}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletingTask(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <Button
                onClick={handleConfirmCompletion}
                disabled={isSubmittingCompletion}
                className="bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-semibold"
              >
                {isSubmittingCompletion ? 'Saving...' : 'Confirm Completed'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
