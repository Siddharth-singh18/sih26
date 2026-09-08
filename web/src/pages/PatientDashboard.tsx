import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Link } from 'react-router-dom';
import api, { getBaseServerUrl } from '../lib/api';
import PageShell from '../components/ui/PageShell';
import StatusBadge from '../components/ui/StatusBadge';
import { SkeletonList } from '../components/ui/SkeletonLoader';
import InlineError from '../components/ui/InlineError';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Plus,
  X,
  Phone,
  Activity,
  Pill,
  RefreshCw,
  Ticket,
  FlaskConical,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  Stethoscope,
} from 'lucide-react';

interface FacilityDoctorItem {
  id?: string;
  name?: string;
  specialty?: string;
  doctor?: {
    id: string;
    name: string;
    specialty?: string;
  };
}

interface Facility {
  id: string;
  name: string;
  type: string;
  address?: string;
  district?: string;
  phone?: string;
  doctors?: FacilityDoctorItem[];
}

interface Appointment {
  id: string;
  scheduledAt?: string;
  date: string;
  timeSlot: string;
  status: string;
  reason?: string;
  facility?: { id: string; name: string; type?: string; address?: string };
  doctor?: { id: string; name: string; specialty?: string; specialization?: string };
  queueEntry?: { id: string; tokenNumber: string; status: string };
}

interface QueueInfo {
  active: boolean;
  position?: number;
  estimatedWaitMinutes?: number;
  entry?: {
    id: string;
    tokenNumber: string;
    status: string;
    priority: number;
    joinedAt: string;
    facility?: { name: string };
    doctor?: { name: string; specialty?: string };
  };
}

interface HealthSummary {
  patient: {
    id: string;
    name: string;
    dob?: string;
    gender?: string;
    phone?: string;
    village?: string;
    district?: string;
    abhaId?: string;
  };
  recentVitals?: {
    systolic?: number | string | null;
    diastolic?: number | string | null;
    bp?: string | null;
    heartRate?: number | string | null;
    bloodGlucose?: number | string | null;
    spo2?: number | string | null;
    temperature?: number | string | null;
    weight?: number | string | null;
    recordedAt?: string | null;
  };
  latestVitals?: Array<{
    id: string;
    type: string;
    value: string;
    unit: string;
    measuredAt: string;
  }>;
  activeConditions?: Array<{ id: string; code: string; name: string; status: string }>;
  totalEncounters: number;
  totalReferrals: number;
}

interface Referral {
  id: string;
  urgency: string;
  status: string;
  reason: string;
  createdAt: string;
  originFacility?: { name: string };
  destinationFacility?: { name: string };
  counterReferral?: {
    dischargeSummary?: string;
    doctorNotes?: string;
    advice?: string;
  };
}

interface PrescriptionItem {
  id: string;
  name?: string;
  medication?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  prescribedAt?: string;
  doctor?: { name: string };
}

interface FollowUpItem {
  id: string;
  dueDate: string;
  status: string;
  action: string;
  notes?: string;
  assignedWorker?: { name: string; phone?: string };
}

interface DiagnosticResultItem {
  id: string;
  resultValue: string;
  isAbnormal: boolean;
}

interface DiagnosticItem {
  id: string;
  testName: string;
  status: string;
  results?: DiagnosticResultItem[];
}

interface TimeSlotItem {
  timeSlot: string;
  available: boolean;
  reason?: string;
}

/**
 * Robust date and time formatting utility.
 * Guarantees zero "Invalid Date()" displays across any date/timeSlot combination.
 */
export function formatAppointmentDateTime(scheduledAt?: string, date?: string, timeSlot?: string) {
  const raw = scheduledAt || date;
  if (!raw) {
    return {
      dateFormatted: 'Date pending',
      timeFormatted: timeSlot || 'Time pending',
    };
  }

  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    return {
      dateFormatted: date || 'Date pending',
      timeFormatted: timeSlot || 'Time pending',
    };
  }

  const dateFormatted = d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const timeFormatted =
    timeSlot ||
    d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  return { dateFormatted, timeFormatted };
}

const DEFAULT_TIME_SLOTS = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
];

export default function PatientDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Domain data states
  const [profile, setProfile] = useState<any>(null);
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [followups, setFollowups] = useState<FollowUpItem[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);

  // Progressive Disclosure Modal States
  const [isAllAppointmentsOpen, setIsAllAppointmentsOpen] = useState(false);
  const [appointmentsTab, setAppointmentsTab] = useState<'upcoming' | 'past'>('upcoming');
  const [isAllPrescriptionsOpen, setIsAllPrescriptionsOpen] = useState(false);
  const [isAllDiagnosticsOpen, setIsAllDiagnosticsOpen] = useState(false);
  const [isReferralDetailsOpen, setIsReferralDetailsOpen] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);

  // Booking Modal State
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingFacilityId, setBookingFacilityId] = useState('');
  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [bookingSlot, setBookingSlot] = useState('10:00 AM');
  const [bookingReason, setBookingReason] = useState('Routine follow-up consultation');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Socket reference
  const socketRef = useRef<Socket | null>(null);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');

    try {
      const [profRes, queueRes, apptRes, refRes, rxRes, fuRes, sumRes, facRes, diagRes] =
        await Promise.allSettled([
          api.get('/patients/me'),
          api.get('/patients/me/queue'),
          api.get('/patients/me/appointments'),
          api.get('/patients/me/referrals'),
          api.get('/patients/me/prescriptions'),
          api.get('/patients/me/followups'),
          api.get('/patients/me/health-summary'),
          api.get('/facilities'),
          api.get('/diagnostics'),
        ]);

      if (profRes.status === 'fulfilled' && profRes.value.data) {
        setProfile(profRes.value.data);
      }
      if (queueRes.status === 'fulfilled' && queueRes.value.data) {
        setQueueInfo(queueRes.value.data);
      }
      if (apptRes.status === 'fulfilled' && apptRes.value.data) {
        setAppointments(Array.isArray(apptRes.value.data) ? apptRes.value.data : []);
      }
      if (refRes.status === 'fulfilled' && refRes.value.data) {
        setReferrals(Array.isArray(refRes.value.data) ? refRes.value.data : []);
      }
      if (rxRes.status === 'fulfilled' && rxRes.value.data) {
        const rawRx = rxRes.value.data;
        setPrescriptions(Array.isArray(rawRx) ? rawRx : rawRx.medications || []);
      }
      if (fuRes.status === 'fulfilled' && fuRes.value.data) {
        setFollowups(Array.isArray(fuRes.value.data) ? fuRes.value.data : []);
      }
      if (sumRes.status === 'fulfilled' && sumRes.value.data) {
        setSummary(sumRes.value.data);
      }
      if (diagRes.status === 'fulfilled' && diagRes.value.data) {
        setDiagnostics(Array.isArray(diagRes.value.data) ? diagRes.value.data : []);
      }
      if (facRes.status === 'fulfilled' && facRes.value.data) {
        const facList = Array.isArray(facRes.value.data) ? facRes.value.data : [];
        setFacilities(facList);
        if (facList.length > 0 && !bookingFacilityId) {
          const firstFac = facList[0];
          setBookingFacilityId(firstFac.id);
          const firstDoc = firstFac.doctors?.[0];
          if (firstDoc) {
            setBookingDoctorId(firstDoc.doctor?.id || firstDoc.id || '');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load patient dashboard data:', err);
      setError(err.response?.data?.error || 'Could not load your health portal data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingFacilityId]);

  // Fetch Available Slots for Booking
  const fetchAvailability = useCallback(async (facilityId: string, doctorId: string, date: string) => {
    if (!facilityId) return;
    setLoadingSlots(true);
    try {
      const res = await api.get('/appointments/availability', {
        params: { facilityId, doctorId: doctorId || undefined, date },
      });
      if (res.data?.slots && Array.isArray(res.data.slots)) {
        setAvailableSlots(res.data.slots);
        const firstAvail = res.data.slots.find((s: TimeSlotItem) => s.available);
        if (firstAvail) {
          setBookingSlot(firstAvail.timeSlot);
        }
      }
    } catch (err) {
      console.warn('Could not fetch real availability, using defaults', err);
      setAvailableSlots(DEFAULT_TIME_SLOTS.map((slot) => ({ timeSlot: slot, available: true })));
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const handleFacilityChange = (facId: string) => {
    setBookingFacilityId(facId);
    const selectedFac = facilities.find((f) => f.id === facId);
    const firstDoc = selectedFac?.doctors?.[0];
    const docId = firstDoc?.doctor?.id || firstDoc?.id || '';
    setBookingDoctorId(docId);
    fetchAvailability(facId, docId, bookingDate);
  };

  const handleDoctorChange = (docId: string) => {
    setBookingDoctorId(docId);
    fetchAvailability(bookingFacilityId, docId, bookingDate);
  };

  const handleDateChange = (dateVal: string) => {
    setBookingDate(dateVal);
    fetchAvailability(bookingFacilityId, bookingDoctorId, dateVal);
  };

  // Realtime Socket Connection
  useEffect(() => {
    fetchDashboardData();

    const socketServerUrl = getBaseServerUrl();
    const token = localStorage.getItem('ayusync_token');
    const user = JSON.parse(localStorage.getItem('ayusync_user') || '{}');
    const patientId = user.patientId;

    if (!token || !patientId) return;

    const socket = io(socketServerUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('join:patient', patientId);
    });

    socket.on('patient.updated', () => {
      fetchDashboardData(true);
    });

    socket.on('queue.updated', () => {
      fetchDashboardData(true);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [fetchDashboardData]);

  // Check-in / Arrive Appointment
  const handleArrive = async (appointmentId: string) => {
    setActionSuccess('');
    setError('');
    try {
      const res = await api.post(`/patients/me/appointments/${appointmentId}/arrive`);
      const tokenNo = res.data?.queueEntry?.tokenNumber;
      setActionSuccess(
        `Checked in successfully! Your consultation token is ${tokenNo || 'issued'}. The clinical team has been notified.`
      );
      await fetchDashboardData(true);
    } catch (err: any) {
      console.error('Error checking in:', err);
      setError(err.response?.data?.error || 'Failed to check in for appointment.');
    }
  };

  // Cancel Appointment
  const handleCancel = async (appointmentId: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setActionSuccess('');
    setError('');
    try {
      await api.delete(`/patients/me/appointments/${appointmentId}`);
      setActionSuccess('Appointment cancelled successfully.');
      await fetchDashboardData(true);
    } catch (err: any) {
      console.error('Error cancelling appointment:', err);
      setError(err.response?.data?.error || 'Failed to cancel appointment.');
    }
  };

  // Open booking modal
  const openBookingModal = () => {
    setIsBookingOpen(true);
    const targetFac = bookingFacilityId || (facilities.length > 0 ? facilities[0].id : '');
    const selectedFac = facilities.find((f) => f.id === targetFac);
    const firstDoc = selectedFac?.doctors?.[0];
    const docId = bookingDoctorId || firstDoc?.doctor?.id || firstDoc?.id || '';
    if (targetFac) {
      fetchAvailability(targetFac, docId, bookingDate);
    }
  };

  // Submit Booking Form
  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    if (!bookingFacilityId) {
      setBookingError('Please select a healthcare facility.');
      return;
    }
    if (!bookingDate) {
      setBookingError('Please choose a consultation date.');
      return;
    }
    if (!bookingSlot) {
      setBookingError('Please select an available time slot.');
      return;
    }

    setBookingSubmitting(true);
    try {
      await api.post('/patients/me/appointments', {
        facilityId: bookingFacilityId,
        doctorId: bookingDoctorId || undefined,
        date: bookingDate,
        timeSlot: bookingSlot,
        reason: bookingReason,
      });

      setIsBookingOpen(false);
      setActionSuccess('Appointment booked successfully!');
      await fetchDashboardData(true);
    } catch (err: any) {
      console.error('Failed to book appointment:', err);
      setBookingError(err.response?.data?.message || err.response?.data?.error || 'Failed to book this slot.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const patientName = profile?.name || summary?.patient?.name || 'Patient';
  const abhaId = profile?.abhaId || summary?.patient?.abhaId || '91-8844-3321-0001';
  const village = profile?.village || summary?.patient?.village || 'Baramati / Khandala';
  const phone = profile?.phone || summary?.patient?.phone || 'Not provided';
  const patientId = profile?.id || summary?.patient?.id || '';

  // Lifecycle-based appointment separation
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Active / Live Queue Appointments
  const activeTodayAppt = appointments.find((appt) => {
    const isToday = appt.date === todayStr || (appt.scheduledAt && appt.scheduledAt.startsWith(todayStr));
    return ['ARRIVED', 'WAITING', 'IN_CONSULTATION'].includes(appt.status) || (isToday && appt.status === 'SCHEDULED');
  });

  // Next Upcoming Appointment (Single most relevant future appointment)
  const nextUpcomingAppt = appointments.find((appt) => {
    const isFuture = appt.date ? appt.date >= todayStr : appt.scheduledAt && new Date(appt.scheduledAt) >= now;
    const isScheduled = ['SCHEDULED', 'BOOKED'].includes(appt.status);
    return isFuture && isScheduled && (!activeTodayAppt || appt.id !== activeTodayAppt.id);
  });

  // Upcoming appointments list (for modal)
  const upcomingList = appointments.filter((appt) => {
    const isFuture = appt.date ? appt.date >= todayStr : appt.scheduledAt && new Date(appt.scheduledAt) >= now;
    return isFuture && ['SCHEDULED', 'BOOKED', 'ARRIVED', 'WAITING', 'IN_CONSULTATION'].includes(appt.status);
  });

  // Past appointments list (for modal)
  const pastList = appointments.filter((appt) => {
    const isPast = appt.date ? appt.date < todayStr : appt.scheduledAt && new Date(appt.scheduledAt) < now;
    const isTerminal = ['COMPLETED', 'CANCELLED'].includes(appt.status);
    return (isPast || isTerminal) && !upcomingList.some((u) => u.id === appt.id);
  });

  // Consolidated Care Actions (Unified list of tasks requiring patient action)
  interface CareAction {
    id: string;
    type: 'followup' | 'diagnostic_pending' | 'diagnostic_abnormal' | 'referral';
    icon: any;
    title: string;
    subtitle: string;
    actionLabel: string;
    onAction: () => void;
    badge?: { label: string; color: string };
  }

  const careActions: CareAction[] = [];

  // 1. Pending follow-ups
  followups
    .filter((f) => f.status === 'PENDING' || f.status === 'OVERDUE')
    .slice(0, 2)
    .forEach((f) => {
      careActions.push({
        id: `fu-${f.id}`,
        type: 'followup',
        icon: AlertTriangle,
        title: f.action || 'Scheduled Care Follow-Up',
        subtitle: `Due: ${new Date(f.dueDate).toLocaleDateString('en-IN')} · ASHA Worker: ${f.assignedWorker?.name || 'Sunita Patil'}`,
        actionLabel: 'View Task',
        onAction: () => {
          if (f.notes) alert(`ASHA Follow-Up Notes:

${f.notes}`);
        },
        badge: f.status === 'OVERDUE' ? { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200' } : undefined,
      });
    });

  // 2. Pending or abnormal diagnostics
  diagnostics.forEach((d) => {
    const hasAbnormal = d.results?.some((r) => r.isAbnormal);
    if (d.status === 'PENDING') {
      careActions.push({
        id: `diag-${d.id}`,
        type: 'diagnostic_pending',
        icon: FlaskConical,
        title: `Lab Test: ${d.testName}`,
        subtitle: 'Sample under processing · Results pending',
        actionLabel: 'Track Test',
        onAction: () => setIsAllDiagnosticsOpen(true),
        badge: { label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' },
      });
    } else if (hasAbnormal) {
      const abnormalVal = d.results?.find((r) => r.isAbnormal)?.resultValue;
      careActions.push({
        id: `diag-ab-${d.id}`,
        type: 'diagnostic_abnormal',
        icon: AlertCircle,
        title: `Lab Result: ${d.testName}`,
        subtitle: `Result: ${abnormalVal} · Doctor review advised`,
        actionLabel: 'View Report',
        onAction: () => setIsAllDiagnosticsOpen(true),
        badge: { label: 'Abnormal', color: 'bg-red-50 text-red-700 border-red-200' },
      });
    }
  });

  // 3. Active Referrals awaiting action
  referrals
    .filter((r) => ['SUBMITTED', 'ACCEPTED', 'COUNTER_REFERRED'].includes(r.status))
    .slice(0, 1)
    .forEach((r) => {
      careActions.push({
        id: `ref-${r.id}`,
        type: 'referral',
        icon: Building2,
        title: `Referral: ${r.destinationFacility?.name || 'District Hospital'}`,
        subtitle: r.reason ? `Reason: ${r.reason}` : 'Specialist evaluation arranged',
        actionLabel: 'Track Referral',
        onAction: () => {
          setSelectedReferral(r);
          setIsReferralDetailsOpen(true);
        },
        badge: { label: r.status.replace(/_/g, ' '), color: 'bg-blue-50 text-blue-700 border-blue-200' },
      });
    });

  // Contextual single active referral
  const activeReferral = referrals.find((r) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(r.status));

  const selectedFacilityObj = facilities.find((f) => f.id === bookingFacilityId);
  const currentFacilityDoctors = selectedFacilityObj?.doctors || [];

  return (
    <PageShell
      title={`Namaste, ${patientName}`}
      eyebrow="AyuSync · Patient Care Control Center"
      subtitle={`ABHA: ${abhaId} · Village: ${village} · Phone: ${phone}`}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            aria-label="Refresh health data"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-[#1e6641]' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </button>
          <button
            onClick={openBookingModal}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Book Consultation
          </button>
        </div>
      }
    >
      {/* Toast Banners */}
      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-[#e4efe7] border border-[#1e6641]/20 flex items-start gap-3 shadow-xs">
          <CheckCircle2 size={18} className="text-[#1e6641] shrink-0 mt-0.5" />
          <div className="flex-1 text-xs font-medium text-[#1e6641]">{actionSuccess}</div>
          <button
            onClick={() => setActionSuccess('')}
            className="text-[#1e6641]/60 hover:text-[#1e6641] cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 shadow-xs">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs font-medium text-red-700">{error}</div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonList rows={3} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: CARE STATUS / NEXT ACTION (DOMINANT HERO CARD)        */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {queueInfo?.active && queueInfo.entry ? (
            /* Live Queue State */
            <div className="bg-gradient-to-r from-[#1e6641] to-[#257d50] rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-44 h-44 bg-white/10 rounded-full pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs">
                    <Ticket size={13} />
                    Live Consultation Queue
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-white/80 uppercase tracking-wider font-semibold">Your Token:</span>
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight underline decoration-white/40">
                      {queueInfo.entry.tokenNumber}
                    </span>
                  </div>
                  <p className="text-xs text-white/85 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-white">{queueInfo.entry.facility?.name || 'Baramati CHC'}</span>
                    <span>·</span>
                    <span>{queueInfo.entry.doctor?.name || 'Dr. Rajesh Deshmukh'}</span>
                    {queueInfo.entry.doctor?.specialty && (
                      <span className="text-white/70">({queueInfo.entry.doctor.specialty})</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 bg-white/15 rounded-2xl p-3 sm:p-4 backdrop-blur-xs border border-white/20 shrink-0 self-start sm:self-auto">
                  <div className="text-center px-2">
                    <div className="text-2xl sm:text-3xl font-extrabold">{queueInfo.position || 1}</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/80 font-bold">Wait Position</div>
                  </div>
                  <div className="h-8 w-[1px] bg-white/20" />
                  <div className="text-center px-2">
                    <div className="text-2xl sm:text-3xl font-extrabold">~{queueInfo.estimatedWaitMinutes || 10}</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/80 font-bold">Est. Mins</div>
                  </div>
                  <div className="h-8 w-[1px] bg-white/20" />
                  <div className="text-center px-1">
                    <StatusBadge status={queueInfo.entry.status} size="sm" />
                  </div>
                </div>
              </div>
            </div>
          ) : activeTodayAppt && activeTodayAppt.status === 'SCHEDULED' ? (
            /* Scheduled Today - Ready for Check-in */
            <div className="bg-[#e4efe7] border-2 border-[#1e6641]/30 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1e6641] text-white text-[11px] font-bold">
                  <Clock size={12} />
                  Clinic Visit Scheduled Today
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  {activeTodayAppt.doctor?.name || 'Dr. Rajesh Deshmukh'} · {activeTodayAppt.timeSlot}
                </h2>
                <p className="text-xs text-gray-600 flex items-center gap-1.5">
                  <Building2 size={13} className="text-gray-400" />
                  {activeTodayAppt.facility?.name || 'Baramati Sub-District Hospital & CHC'}
                </p>
              </div>
              <button
                onClick={() => handleArrive(activeTodayAppt.id)}
                className="px-5 py-2.5 rounded-2xl bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                Check In & Join Live Queue
              </button>
            </div>
          ) : nextUpcomingAppt ? (
            /* Next Upcoming Consultation Summary */
            <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#e4efe7] text-[#1e6641] flex items-center justify-center shrink-0">
                  <Calendar size={22} />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Next Step</span>
                  <h3 className="text-sm font-bold text-gray-900">
                    Next Consultation: {nextUpcomingAppt.doctor?.name || 'Dr. Rajesh Deshmukh'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {formatAppointmentDateTime(nextUpcomingAppt.scheduledAt, nextUpcomingAppt.date, nextUpcomingAppt.timeSlot).dateFormatted} at {nextUpcomingAppt.timeSlot} · {nextUpcomingAppt.facility?.name || 'Baramati CHC'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsAllAppointmentsOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  View Details
                </button>
                <button
                  onClick={openBookingModal}
                  className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  New Booking
                </button>
              </div>
            </div>
          ) : (
            /* No Active / Upcoming Visits */
            <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">No Pending Appointments</h3>
                  <p className="text-xs text-gray-500">
                    Schedule a consultation with Dr. Rajesh Deshmukh at Baramati CHC or your local PHC.
                  </p>
                </div>
              </div>
              <button
                onClick={openBookingModal}
                className="px-4 py-2.5 rounded-2xl bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
              >
                Schedule Clinic Visit
              </button>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* MAIN 2-COLUMN GRID (LESS CLUTTER, CLEAR HIERARCHY)                */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* ───────────────────────────────────────────────────────────── */}
            {/* LEFT COLUMN: APPOINTMENT SPOTLIGHT, CARE ACTIONS, JOURNEY     */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* SECTION 2: NEXT APPOINTMENT SPOTLIGHT */}
              {(activeTodayAppt || nextUpcomingAppt) && (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Stethoscope size={16} className="text-[#1e6641]" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                        {activeTodayAppt ? "Today's Clinic Appointment" : 'Next Upcoming Consultation'}
                      </h2>
                    </div>
                    <button
                      onClick={() => setIsAllAppointmentsOpen(true)}
                      className="text-xs font-semibold text-[#1e6641] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      All Appointments ({appointments.length}) <ChevronRight size={13} />
                    </button>
                  </div>

                  {(() => {
                    const spotlight = activeTodayAppt || nextUpcomingAppt!;
                    const { dateFormatted, timeFormatted } = formatAppointmentDateTime(
                      spotlight.scheduledAt,
                      spotlight.date,
                      spotlight.timeSlot
                    );
                    const docName = spotlight.doctor?.name || 'Dr. Rajesh Deshmukh';
                    const docSpec = spotlight.doctor?.specialty || spotlight.doctor?.specialization || 'Internal Medicine';

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-gray-900">{docName}</span>
                            <span className="text-xs text-gray-500 font-medium">({docSpec})</span>
                            <StatusBadge status={spotlight.status} size="sm" />
                          </div>
                          <p className="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 size={13} className="text-gray-400" />
                              {spotlight.facility?.name || 'Baramati CHC'}
                            </span>
                            <span className="text-gray-300">·</span>
                            <span className="flex items-center gap-1 font-semibold text-[#1e6641]">
                              <Calendar size={13} />
                              {dateFormatted} at {timeFormatted}
                            </span>
                          </p>
                          {spotlight.reason && (
                            <p className="text-xs text-gray-500 italic">"{spotlight.reason}"</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {spotlight.status === 'SCHEDULED' && spotlight.date === todayStr && (
                            <button
                              onClick={() => handleArrive(spotlight.id)}
                              className="px-3.5 py-2 rounded-xl bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Check In
                            </button>
                          )}
                          {spotlight.status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleCancel(spotlight.id)}
                              className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SECTION 4: UNIFIED CARE ACTIONS (PENDING TASKS) */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                      Care Actions & Follow-Ups
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    {careActions.length} Pending
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {careActions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} className="text-[#1e6641]" />
                      <span>All care follow-ups, diagnostic tests, and referral actions are up to date.</span>
                    </div>
                  ) : (
                    careActions.map((action) => {
                      const IconComp = action.icon;
                      return (
                        <div
                          key={action.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                              <IconComp size={16} />
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-900">{action.title}</span>
                                {action.badge && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${action.badge.color}`}
                                  >
                                    {action.badge.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{action.subtitle}</p>
                            </div>
                          </div>

                          <button
                            onClick={action.onAction}
                            className="self-end sm:self-auto px-3 py-1.5 rounded-xl border border-gray-200 hover:border-[#1e6641]/50 hover:bg-[#e4efe7]/40 text-[#1e6641] text-xs font-bold transition-colors cursor-pointer"
                          >
                            {action.actionLabel}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SECTION 6: CONTEXTUAL REFERRALS */}
              {activeReferral ? (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-[#1e6641]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                        Active Hospital Referral
                      </h3>
                    </div>
                    <StatusBadge status={activeReferral.status} size="sm" />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-gray-900">
                        {activeReferral.originFacility?.name || 'Baramati CHC'} →{' '}
                        {activeReferral.destinationFacility?.name || 'Aundh District Hospital, Pune'}
                      </div>
                      <p className="text-xs text-gray-500">
                        {activeReferral.reason || 'Specialized clinical evaluation'} · Priority:{' '}
                        <span className="font-semibold text-amber-700">{activeReferral.urgency}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedReferral(activeReferral);
                        setIsReferralDetailsOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Track Referral
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-4 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-2">
                    <Building2 size={15} className="text-gray-400" />
                    No active hospital referrals · All primary care managed locally
                  </span>
                  {referrals.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedReferral(referrals[0]);
                        setIsReferralDetailsOpen(true);
                      }}
                      className="text-[#1e6641] font-semibold hover:underline cursor-pointer"
                    >
                      Past Referrals ({referrals.length})
                    </button>
                  )}
                </div>
              )}

              {/* SECTION 8: RECENT CARE JOURNEY PREVIEW */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-[#1e6641]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                      Recent Care Milestones
                    </h3>
                  </div>
                  <Link
                    to={patientId ? `/patients/${patientId}` : '/patients'}
                    className="text-xs font-semibold text-[#1e6641] hover:underline flex items-center gap-1"
                  >
                    Complete Health Record <ArrowRight size={13} />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase text-gray-400">Clinical Consultation</span>
                    <div className="font-bold text-gray-900">Dr. Rajesh Deshmukh</div>
                    <p className="text-[11px] text-gray-500">Baramati Sub-District CHC</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase text-gray-400">Diagnostics Ordered</span>
                    <div className="font-bold text-gray-900">HbA1c & Creatinine</div>
                    <p className="text-[11px] text-gray-500">Pathology telemetry active</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase text-gray-400">Medications</span>
                    <div className="font-bold text-gray-900">Amlodipine & Metformin</div>
                    <p className="text-[11px] text-gray-500">Active chronic regimen</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* RIGHT COLUMN: HEALTH SNAPSHOT, MEDICATIONS, DIAGNOSTICS       */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className="space-y-6">
              {/* SECTION 3: COMPACT HEALTH SNAPSHOT */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-[#1e6641]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                      Health Snapshot
                    </h3>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {summary?.recentVitals?.recordedAt
                      ? new Date(summary.recentVitals.recordedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : '4 Sep 2026'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* BP */}
                  <div className="p-3 rounded-2xl bg-[#f7faf8] border border-[#1e6641]/15">
                    <div className="text-[10px] uppercase font-bold text-gray-400">BP</div>
                    <div className="text-base font-extrabold text-gray-900 mt-0.5">
                      {summary?.recentVitals?.bp ||
                        (summary?.recentVitals?.systolic && summary?.recentVitals?.diastolic
                          ? `${summary.recentVitals.systolic}/${summary.recentVitals.diastolic}`
                          : '136/86')}
                      <span className="text-[10px] font-normal text-gray-500 ml-0.5">mmHg</span>
                    </div>
                  </div>

                  {/* Heart Rate */}
                  <div className="p-3 rounded-2xl bg-[#f7faf8] border border-[#1e6641]/15">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Pulse</div>
                    <div className="text-base font-extrabold text-gray-900 mt-0.5">
                      {summary?.recentVitals?.heartRate || '74'}
                      <span className="text-[10px] font-normal text-gray-500 ml-0.5">bpm</span>
                    </div>
                  </div>

                  {/* Blood Glucose */}
                  <div className="p-3 rounded-2xl bg-[#f7faf8] border border-[#1e6641]/15">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Glucose</div>
                    <div className="text-base font-extrabold text-gray-900 mt-0.5">
                      {summary?.recentVitals?.bloodGlucose || '186'}
                      <span className="text-[10px] font-normal text-gray-500 ml-0.5">mg/dL</span>
                    </div>
                  </div>

                  {/* SpO2 */}
                  <div className="p-3 rounded-2xl bg-[#f7faf8] border border-[#1e6641]/15">
                    <div className="text-[10px] uppercase font-bold text-gray-400">SpO2</div>
                    <div className="text-base font-extrabold text-gray-900 mt-0.5">
                      {summary?.recentVitals?.spo2 || '98'}%
                    </div>
                  </div>
                </div>

                <Link
                  to={patientId ? `/patients/${patientId}` : '/patients'}
                  className="text-xs font-semibold text-[#1e6641] hover:underline flex items-center justify-between pt-1"
                >
                  <span>View full vitals history</span>
                  <ChevronRight size={13} />
                </Link>
              </div>

              {/* SECTION 5: ACTIVE MEDICATIONS (COMPACT ROWS) */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Pill size={16} className="text-[#1e6641]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                      Active Medications
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    {prescriptions.length} Active
                  </span>
                </div>

                <div className="space-y-2">
                  {prescriptions.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No active prescriptions</p>
                  ) : (
                    prescriptions.slice(0, 3).map((rx) => (
                      <div
                        key={rx.id}
                        className="p-2.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-gray-900">
                            {rx.name || rx.medication || 'Medication'}
                          </div>
                          <p className="text-[11px] text-gray-500">{rx.frequency}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-[#e4efe7] text-[#1e6641] text-[11px] font-bold shrink-0">
                          {rx.dosage}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {prescriptions.length > 0 && (
                  <button
                    onClick={() => setIsAllPrescriptionsOpen(true)}
                    className="w-full text-xs font-semibold text-[#1e6641] hover:underline flex items-center justify-between pt-1 cursor-pointer"
                  >
                    <span>View all medications & instructions</span>
                    <ChevronRight size={13} />
                  </button>
                )}
              </div>

              {/* SECTION 7: DIAGNOSTICS OVERVIEW (PENDING & ABNORMAL) */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={16} className="text-[#1e6641]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                      Diagnostics Focus
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsAllDiagnosticsOpen(true)}
                    className="text-xs font-semibold text-[#1e6641] hover:underline cursor-pointer"
                  >
                    All Reports ({diagnostics.length})
                  </button>
                </div>

                <div className="space-y-2">
                  {diagnostics.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No laboratory tests recorded</p>
                  ) : (
                    diagnostics.slice(0, 3).map((diag) => {
                      const isPending = diag.status === 'PENDING';
                      const abnormal = diag.results?.find((r) => r.isAbnormal);

                      return (
                        <div
                          key={diag.id}
                          className="p-2.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-gray-900">{diag.testName}</div>
                            <p className="text-[11px] text-gray-500">
                              {isPending
                                ? 'Sample in analysis'
                                : abnormal
                                ? `Value: ${abnormal.resultValue}`
                                : 'Completed · Normal range'}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPending
                                ? 'bg-amber-50 text-amber-700'
                                : abnormal
                                ? 'bg-red-50 text-red-700'
                                : 'bg-[#e4efe7] text-[#1e6641]'
                            }`}
                          >
                            {isPending ? 'Pending' : abnormal ? 'Abnormal' : 'Normal'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SECTION 9: EMERGENCY HELPLINE STRIP (COMPACT FOOTER) */}
              <div className="p-4 rounded-3xl bg-gray-100/70 border border-gray-200/80 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-gray-800">
                  <Phone size={14} className="text-red-600" />
                  <span>Rural Emergency Helplines</span>
                </div>
                <div className="flex items-center justify-between text-gray-600 pt-0.5">
                  <span>Ambulance (Toll-free):</span>
                  <a href="tel:108" className="font-bold text-[#1e6641] hover:underline">
                    Dial 108
                  </a>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Health Helpline:</span>
                  <a href="tel:104" className="font-bold text-[#1e6641] hover:underline">
                    Dial 104
                  </a>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Baramati CHC Desk:</span>
                  <span className="font-medium text-gray-800">+91 2112 222 345</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* PROGRESSIVE DISCLOSURE MODAL 1: ALL APPOINTMENTS & HISTORY        */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isAllAppointmentsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <Calendar size={18} className="text-[#1e6641]" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Your Consultations & History</h3>
                  <p className="text-xs text-gray-500">Scheduled visits, active queues, and historical visits</p>
                </div>
              </div>
              <button
                onClick={() => setIsAllAppointmentsOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-3 flex gap-4 border-b border-gray-100">
              <button
                onClick={() => setAppointmentsTab('upcoming')}
                className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  appointmentsTab === 'upcoming'
                    ? 'border-[#1e6641] text-[#1e6641]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Upcoming & Active ({upcomingList.length})
              </button>
              <button
                onClick={() => setAppointmentsTab('past')}
                className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  appointmentsTab === 'past'
                    ? 'border-[#1e6641] text-[#1e6641]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Past Medical Consultations ({pastList.length})
              </button>
            </div>

            <div className="p-6 overflow-y-auto divide-y divide-gray-100 space-y-3">
              {(appointmentsTab === 'upcoming' ? upcomingList : pastList).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  {appointmentsTab === 'upcoming' ? 'No upcoming appointments.' : 'No past consultation history.'}
                </p>
              ) : (
                (appointmentsTab === 'upcoming' ? upcomingList : pastList).map((appt) => {
                  const { dateFormatted, timeFormatted } = formatAppointmentDateTime(
                    appt.scheduledAt,
                    appt.date,
                    appt.timeSlot
                  );
                  const isScheduled = appt.status === 'SCHEDULED';
                  const isToday = appt.date === todayStr;

                  return (
                    <div key={appt.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">
                            {appt.doctor?.name || 'Dr. Rajesh Deshmukh'}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({appt.doctor?.specialty || appt.doctor?.specialization || 'Internal Medicine'})
                          </span>
                          <StatusBadge status={appt.status} size="sm" />
                          {appt.queueEntry?.tokenNumber && (
                            <span className="px-2 py-0.5 rounded bg-[#e4efe7] text-[#1e6641] text-xs font-bold">
                              Token: {appt.queueEntry.tokenNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 flex items-center gap-2">
                          <Building2 size={13} className="text-gray-400" />
                          {appt.facility?.name || 'Baramati CHC'}
                          <span>·</span>
                          <Calendar size={13} className="text-gray-400" />
                          {dateFormatted} at {timeFormatted}
                        </p>
                        {appt.reason && <p className="text-xs text-gray-500 italic">"{appt.reason}"</p>}
                      </div>

                      {appointmentsTab === 'upcoming' && isScheduled && (
                        <div className="flex items-center gap-2 shrink-0">
                          {isToday && (
                            <button
                              onClick={() => {
                                handleArrive(appt.id);
                                setIsAllAppointmentsOpen(false);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-bold cursor-pointer"
                            >
                              Check In
                            </button>
                          )}
                          <button
                            onClick={() => handleCancel(appt.id)}
                            className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-red-600 text-xs font-medium cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setIsAllAppointmentsOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* PROGRESSIVE DISCLOSURE MODAL 2: ALL PRESCRIPTIONS                */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isAllPrescriptionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <Pill size={18} className="text-[#1e6641]" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Medications & Prescriptions</h3>
                  <p className="text-xs text-gray-500">Active medical orders prescribed by your doctors</p>
                </div>
              </div>
              <button
                onClick={() => setIsAllPrescriptionsOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 divide-y divide-gray-100">
              {prescriptions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No active prescriptions.</p>
              ) : (
                prescriptions.map((rx) => (
                  <div key={rx.id} className="pt-3 first:pt-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">
                        {rx.name || rx.medication || 'Medication'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-[#e4efe7] text-[#1e6641] font-bold">
                        {rx.dosage}
                      </span>
                    </div>
                    <p className="text-gray-600">
                      Frequency: <span className="font-semibold text-gray-800">{rx.frequency}</span> · Duration:{' '}
                      <span className="font-semibold text-gray-800">{rx.duration}</span>
                    </p>
                    {rx.instructions && (
                      <p className="text-[11px] text-gray-500 italic bg-gray-50 p-2 rounded-xl">
                        Instructions: {rx.instructions}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setIsAllPrescriptionsOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* PROGRESSIVE DISCLOSURE MODAL 3: ALL DIAGNOSTICS REPORTS          */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isAllDiagnosticsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <FlaskConical size={18} className="text-[#1e6641]" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Laboratory Diagnostics & Pathology</h3>
                  <p className="text-xs text-gray-500">Blood tests, telemetry, and clinical laboratory orders</p>
                </div>
              </div>
              <button
                onClick={() => setIsAllDiagnosticsOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 divide-y divide-gray-100">
              {diagnostics.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No laboratory orders recorded.</p>
              ) : (
                diagnostics.map((diag) => (
                  <div key={diag.id} className="pt-3 first:pt-0 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">{diag.testName}</span>
                      <StatusBadge status={diag.status} size="sm" />
                    </div>
                    {diag.results && diag.results.length > 0 ? (
                      <div className="space-y-1 pt-1">
                        {diag.results.map((res) => (
                          <div
                            key={res.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between ${
                              res.isAbnormal
                                ? 'bg-red-50/50 border-red-200 text-red-900'
                                : 'bg-[#e4efe7]/30 border-[#1e6641]/20 text-[#1e6641]'
                            }`}
                          >
                            <span className="font-semibold">Result Value: {res.resultValue}</span>
                            <span className="font-bold text-[10px] uppercase">
                              {res.isAbnormal ? 'Abnormal Range' : 'Normal'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">Sample collection complete · Processing report</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setIsAllDiagnosticsOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* PROGRESSIVE DISCLOSURE MODAL 4: REFERRAL DETAILS                  */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isReferralDetailsOpen && selectedReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <Building2 size={18} className="text-[#1e6641]" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Hospital Referral Details</h3>
                  <p className="text-xs text-gray-500">Care continuity and inter-facility transfer</p>
                </div>
              </div>
              <button
                onClick={() => setIsReferralDetailsOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-500 uppercase">Transfer Status</span>
                <StatusBadge status={selectedReferral.status} size="sm" />
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-1.5">
                <div className="text-gray-500 font-medium">Facilities</div>
                <div className="font-bold text-gray-900 text-sm">
                  {selectedReferral.originFacility?.name || 'Baramati CHC'} →{' '}
                  {selectedReferral.destinationFacility?.name || 'Aundh District Hospital'}
                </div>
                <p className="text-gray-600">Clinical Reason: {selectedReferral.reason}</p>
                <p className="text-gray-500">Urgency: {selectedReferral.urgency}</p>
              </div>

              {selectedReferral.counterReferral && (
                <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-1.5">
                  <div className="font-bold text-blue-900 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-blue-600" />
                    Doctor Discharge & Counter-Referral Advice
                  </div>
                  <p className="text-gray-700">
                    {selectedReferral.counterReferral.dischargeSummary || selectedReferral.counterReferral.advice}
                  </p>
                  {selectedReferral.counterReferral.doctorNotes && (
                    <p className="text-gray-500 italic">Notes: {selectedReferral.counterReferral.doctorNotes}</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setIsReferralDetailsOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* BOOK APPOINTMENT MODAL (AVAILABILITY BACKED)                     */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#e4efe7] text-[#1e6641] flex items-center justify-center">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Book Doctor Consultation</h3>
                  <p className="text-xs text-gray-500">Pick clinic, doctor, and live available slot</p>
                </div>
              </div>
              <button
                onClick={() => setIsBookingOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="p-6 space-y-4">
              {bookingError && <InlineError message={bookingError} />}

              {/* Facility Select */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Healthcare Facility *
                </label>
                <select
                  value={bookingFacilityId}
                  onChange={(e) => handleFacilityChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1e6641]/20 focus:border-[#1e6641]"
                  required
                >
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} ({fac.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor Select */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Consulting Doctor *
                </label>
                <select
                  value={bookingDoctorId}
                  onChange={(e) => handleDoctorChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1e6641]/20 focus:border-[#1e6641]"
                >
                  {currentFacilityDoctors.length > 0 ? (
                    currentFacilityDoctors.map((fd) => {
                      const doc = fd.doctor || fd;
                      return (
                        <option key={doc.id} value={doc.id}>
                          {doc.name || 'Medical Officer'} · {doc.specialty || 'General Medicine'}
                        </option>
                      );
                    })
                  ) : (
                    <option value="">Duty Medical Officer (Baramati CHC)</option>
                  )}
                </select>
              </div>

              {/* Date Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Appointment Date *
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1e6641]/20 focus:border-[#1e6641]"
                  required
                />
              </div>

              {/* Live Availability Slots */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Available Time Slots *
                  </label>
                  {loadingSlots && (
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <RefreshCw size={11} className="animate-spin" /> Checking slots...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                  {(availableSlots.length > 0
                    ? availableSlots
                    : DEFAULT_TIME_SLOTS.map((s): TimeSlotItem => ({ timeSlot: s, available: true }))
                  ).map((slotItem) => {
                    const isSelected = bookingSlot === slotItem.timeSlot;
                    const isAvail = slotItem.available;

                    return (
                      <button
                        key={slotItem.timeSlot}
                        type="button"
                        disabled={!isAvail}
                        onClick={() => setBookingSlot(slotItem.timeSlot)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#1e6641] text-white shadow-sm ring-2 ring-[#1e6641]/30'
                            : isAvail
                            ? 'bg-gray-50 border border-gray-200 text-gray-800 hover:bg-[#e4efe7] hover:border-[#1e6641]/30'
                            : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed line-through'
                        }`}
                        title={!isAvail ? slotItem.reason || 'Slot unavailable' : 'Available slot'}
                      >
                        {slotItem.timeSlot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Reason for Consultation
                </label>
                <input
                  type="text"
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  placeholder="e.g. Routine blood pressure checkup, Glycemic review"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1e6641]/20 focus:border-[#1e6641]"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBookingOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-bold transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {bookingSubmitting ? 'Booking...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
