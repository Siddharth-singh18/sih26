import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import InlineError from '../components/ui/InlineError';
import AiTriageCard from '../components/triage/AiTriageCard';
import { ArrowLeft, User, MapPin, Phone, Calendar, ChevronRight, Plus, X, CheckCircle2 } from 'lucide-react';

const REFERRAL_TRANSITIONS: Record<string, { label: string; next: string[] }> = {
  CREATED:             { label: 'Draft',                    next: ['SUBMITTED', 'CANCELLED']                          },
  SUBMITTED:           { label: 'Sent to clinic',           next: ['ACCEPTED', 'REJECTED']                            },
  ACCEPTED:            { label: 'Clinic accepted',          next: ['SCHEDULED']                                       },
  SCHEDULED:           { label: 'Appointment set',          next: ['PATIENT_ARRIVED', 'CANCELLED']                    },
  PATIENT_ARRIVED:     { label: 'Patient arrived',          next: ['IN_CONSULTATION']                                  },
  IN_CONSULTATION:     { label: 'In consultation',          next: ['DIAGNOSTICS_PENDING', 'TREATMENT', 'COUNTER_REFERRED'] },
  DIAGNOSTICS_PENDING: { label: 'Tests in progress',        next: ['TREATMENT', 'COUNTER_REFERRED']                   },
  TREATMENT:           { label: 'Under treatment',          next: ['COUNTER_REFERRED']                                 },
  COUNTER_REFERRED:    { label: 'Doctor sent instructions', next: ['FOLLOW_UP_REQUIRED', 'COMPLETED']                  },
  FOLLOW_UP_REQUIRED:  { label: 'Follow-up needed',         next: ['COMPLETED']                                        },
  COMPLETED:           { label: 'Case closed',              next: []                                                   },
  CANCELLED:           { label: 'Cancelled',                next: []                                                   },
};

const NEXT_LABEL: Record<string, string> = {
  SUBMITTED: 'Mark as sent', ACCEPTED: 'Clinic accepted', REJECTED: 'Mark declined',
  SCHEDULED: 'Appointment booked', PATIENT_ARRIVED: 'Patient has arrived',
  IN_CONSULTATION: 'Start consultation', DIAGNOSTICS_PENDING: 'Awaiting tests',
  TREATMENT: 'Under treatment', COUNTER_REFERRED: 'Doctor sent instructions',
  FOLLOW_UP_REQUIRED: 'Needs follow-up', COMPLETED: 'Mark complete', CANCELLED: 'Cancel',
};

export default function PatientProfile() {
  const { id } = useParams();
  const [patient,   setPatient]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [symptomInput, setSymptomInput] = useState('');
  const [assError,  setAssError]  = useState('');
  const [saving,    setSaving]    = useState(false);

  const fetch = async () => {
    try { setLoading(true);
      const r = await api.get(`/patients/${id}/timeline`);
      setPatient(r.data);
    } catch (e: any) { setError(e.response?.data?.error || 'Could not load this patient.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (id) fetch(); }, [id]);

  const addAssessment = async () => {
    setAssError('');
    const trimmed = symptomInput.trim();
    if (!trimmed || trimmed.length < 2) {
      setAssError('Symptom name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/assessments', {
        patientId: patient.id,
        encounterId: patient?.encounters?.[0]?.id || undefined,
        symptoms: [{ name: trimmed, duration: '1 day', severity: 'MODERATE' }],
        vitals: [],
        provenance: 'WORKER_RECORDED'
      });
      setSymptomInput('');
      setAssError('');
      setShowForm(false);
      await fetch();
    } catch (e: any) {
      setAssError(e.response?.data?.error || e.response?.data?.message || 'Could not save assessment note.');
    } finally {
      setSaving(false);
    }
  };

  const transition = async (refId: string, next: string) => {
    try {
      await api.put(`/referrals/${refId}/status`, { newStatus: next, notes: 'Updated from patient profile' });
      await fetch();
    } catch (e: any) { setError(e.response?.data?.error || e.response?.data?.message || 'Could not update referral status.'); }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-page-in">
        <div className="skeleton h-28 w-full rounded-2xl" />
        <div className="grid md:grid-cols-3 gap-4">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl md:col-span-2" />
        </div>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="p-8 text-center space-y-4">
        <InlineError message={error} onDismiss={() => setError('')} />
        <Link to="/patients"><Button variant="outline"><ArrowLeft size={14} className="mr-1" /> Back to patients</Button></Link>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="space-y-5 pb-16 animate-page-in">
      <InlineError message={error} onDismiss={() => setError('')} />

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#e4efe7] text-[#1e6641] flex items-center justify-center font-bold text-xl shrink-0">
              {patient.name?.charAt(0) || 'P'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-0.5">
                <span>{patient.age || '--'} yrs</span>
                <span>·</span><span>{patient.gender || '--'}</span>
                {(patient.village || patient.address) && <><span>·</span><span>{patient.village || patient.address}</span></>}
              </div>
            </div>
          </div>
          <Link to="/patients">
            <Button variant="outline" className="text-xs flex items-center gap-1">
              <ArrowLeft size={13} /> All patients
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Left: About this patient */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 pb-3 border-b border-gray-50">About this patient</h2>
          <dl className="space-y-3 text-xs">
            {[
              { icon: Phone,    label: 'Phone',       value: patient.phone || 'Not recorded' },
              { icon: MapPin,   label: 'Village',     value: patient.village || patient.address || 'Baramati Rural' },
              { icon: User,     label: 'ABHA / ID',   value: patient.identifiers?.[0]?.value || patient.abhaId || 'Not assigned' },
              { icon: User,     label: 'Assigned to', value: 'Sunita Patil (ASHA)' },
              { icon: Calendar, label: 'Enrolled',    value: new Date(patient.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
            ].map(row => (
              <div key={row.label} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <row.icon size={13} className="text-gray-400" />
                </div>
                <div>
                  <div className="text-gray-400">{row.label}</div>
                  <div className="font-medium text-gray-900 mt-0.5">{row.value}</div>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* Right: Visit history */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 md:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 pb-3 border-b border-gray-50">Visit history</h2>

          {!patient.encounters?.length ? (
            <p className="text-sm text-gray-400 italic">No visits recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {patient.encounters.map((enc: any) => (
                <div key={enc.id} className="border-l-2 border-[#1e6641]/30 pl-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{enc.type.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-gray-400">{new Date(enc.start).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <StatusBadge status={enc.status} />
                  </div>

                  {enc.assessments?.map((ass: any) => (
                    <div key={ass.id} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 space-y-2">
                      <div className="text-xs font-semibold text-gray-700">Symptoms noted:</div>
                      <div className="text-xs text-gray-600">
                        {ass.symptoms?.map((s: any) => s.name).join(', ') || 'No specific symptoms noted'}
                      </div>
                      {ass.aiRecommendations?.length > 0 && (
                        <div className="pt-1">
                          {ass.aiRecommendations.map((ai: any) => (
                            <AiTriageCard
                              key={ai.id}
                              score={ai.confidence || 0}
                              urgencyLevel={ai.urgencyCategory as any}
                              explanation={ai.reasons?.[0] || 'Health risk assessment'}
                              provenanceModel="AyuSync Triage v1.2"
                              confidence={ai.confidence || 0}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Add assessment */}
          <div className="pt-3 border-t border-gray-50">
            {!showForm ? (
              <button
                onClick={() => { setShowForm(true); setAssError(''); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#1e6641] hover:underline"
              >
                <Plus size={13} /> Add assessment note
              </button>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-900">New assessment</span>
                  <button onClick={() => { setShowForm(false); setAssError(''); }} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                </div>
                {assError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
                    {assError}
                  </div>
                )}
                <div>
                  <input
                    type="text"
                    placeholder="Main symptom (e.g. High Fever)"
                    value={symptomInput}
                    onChange={e => {
                      setSymptomInput(e.target.value);
                      if (assError) setAssError('');
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#1e6641] focus:outline-none bg-white ${
                      assError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200'
                    }`}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addAssessment} disabled={saving || !symptomInput.trim()} className="bg-[#1e6641] hover:bg-[#165032] text-white text-xs">
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button onClick={() => { setShowForm(false); setAssError(''); }} variant="outline" className="text-xs">Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Referrals ── */}
      {patient.referrals?.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Referral history</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {patient.referrals.map((ref: any) => {
              const config = REFERRAL_TRANSITIONS[ref.status] || { label: ref.status, next: [] };
              return (
                <div key={ref.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={ref.status} size="md" />
                    <span className="text-xs text-gray-400">{new Date(ref.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <span className="font-medium text-gray-800">From:</span> {ref.origin?.name || 'Sub-center'}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <ChevronRight size={11} className="text-gray-300 shrink-0" />
                      <span className="font-medium text-gray-800">To:</span> {ref.destination?.name || ref.destinationId}
                    </div>
                    {ref.reason && (
                      <div className="text-gray-500 italic">{ref.reason}</div>
                    )}
                  </div>
                  {config.next.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                      {config.next.map(nextStatus => (
                        <button
                          key={nextStatus}
                          onClick={() => transition(ref.id, nextStatus)}
                          className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                            nextStatus === 'COMPLETED'
                              ? 'bg-[#e4efe7] text-[#1e6641] hover:bg-[#1e6641] hover:text-white'
                              : nextStatus === 'CANCELLED' || nextStatus === 'REJECTED'
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {nextStatus === 'COMPLETED' && <CheckCircle2 size={12} />}
                          {NEXT_LABEL[nextStatus] || nextStatus.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
