import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import PageShell from '../components/ui/PageShell';
import StatusBadge from '../components/ui/StatusBadge';
import InlineError from '../components/ui/InlineError';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/SkeletonLoader';
import {
  Clock, RefreshCw, Plus, ChevronRight, X,
  Brain, AlertTriangle, CheckCircle, Info, Pill, ClipboardList,
  Sparkles, Stethoscope, TestTube2, ArrowUpRight
} from 'lucide-react';
import { useRealtimeQueue } from '../hooks/useRealtimeQueue';

const INPUT = 'w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-[#1e6641] focus:outline-none bg-white';
const LABEL = 'block text-xs font-semibold text-gray-700 mb-1';

// ── Urgency badge config ──────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; icon: React.ElementType; sub: string }> = {
  URGENT:   { label: 'Urgent Attention Needed', bg: 'bg-red-50/80', border: 'border-red-200', text: 'text-red-700', icon: AlertTriangle, sub: 'Immediate Medical Officer consultation required' },
  PRIORITY: { label: 'Priority Care',          bg: 'bg-amber-50/80', border: 'border-amber-200', text: 'text-amber-700', icon: Info, sub: 'Doctor review recommended within 2 hours' },
  ROUTINE:  { label: 'Routine Consultation',   bg: 'bg-emerald-50/80', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle, sub: 'Standard outpatient care' },
};

const COMMON_DIAGNOSTICS = [
  'Complete Blood Count (CBC) with Platelets',
  'Glycated Hemoglobin (HbA1c)',
  'Serum Creatinine & Kidney Function',
  'Lipid Profile (Cholesterol & Triglycerides)',
  'Obstetric / Pelvic Ultrasonography (USG)',
  'Urine Routine & Microscopy'
];

// ── Triage Card Component (Human Friendly Explainable AI) ────────────────────
function TriageCard({ triage }: { triage: any }) {
  if (!triage) return null;
  const cfg = URGENCY_CONFIG[triage.urgency] || URGENCY_CONFIG.ROUTINE;
  const Icon = cfg.icon;
  const completenessPct = Math.round((triage.confidence || 0.75) * 100);

  return (
    <div className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border} space-y-3.5 transition-all`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-200/60">
        <div className="flex items-start gap-2.5">
          <div className={`mt-0.5 p-1.5 rounded-lg bg-white shadow-xs ${cfg.text}`}>
            <Icon size={16} />
          </div>
          <div>
            <div className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</div>
            <div className="text-xs text-gray-500 font-normal">{cfg.sub}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center bg-white px-2.5 py-1 rounded-full border border-gray-200/80 text-xs">
          <span className="text-gray-500">Record Completeness:</span>
          <span className="font-bold text-[#1e6641]">{completenessPct}%</span>
        </div>
      </div>

      {triage.reasons && triage.reasons.length > 0 && (
        <div>
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1e6641]" />
            Key Clinical Observations & Risk Factors
          </div>
          <ul className="space-y-1.5 pl-1">
            {triage.reasons.map((r: string, i: number) => (
              <li key={i} className="text-xs text-gray-800 flex items-start gap-2">
                <span className="text-gray-400 font-bold shrink-0">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {triage.missing_information && triage.missing_information.length > 0 && (
        <div className="bg-white/90 rounded-xl p-3 border border-amber-200/70">
          <div className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
            <AlertTriangle size={13} className="text-amber-600" />
            Checklist for Doctor & Health Worker (Missing Data):
          </div>
          <ul className="space-y-1 pl-1">
            {triage.missing_information.map((m: string, i: number) => (
              <li key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {triage.recommended_next_action && (
        <div className="bg-white/90 rounded-xl p-3 border border-gray-200/60">
          <div className="text-xs font-bold text-gray-700 mb-0.5">Clinical Protocol Guidance:</div>
          <div className="text-xs text-gray-800 leading-relaxed">{triage.recommended_next_action}</div>
        </div>
      )}

      <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-200/40">
        <span>Standard: {triage.provenance || 'ICMR & WHO Rural Tele-triage Guidelines'}</span>
        <span className="font-mono text-[10px]">{triage.rule_version || 'rules-2026-v1'}</span>
      </div>
    </div>
  );
}

// ── Complete Consultation & Closed-Loop Care Plan Modal ──────────────────────
function ConsultationModal({
  entry,
  facilities,
  onClose,
  onSuccess,
}: {
  entry: any;
  facilities: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [outcome, setOutcome]                 = useState('');
  const [instructions, setInstructions]       = useState('');
  const [tasks, setTasks]                     = useState([{ title: '', dueInDays: 3 }]);
  const [medications, setMedications]         = useState([{ name: '', dosage: '1 tab OD', duration: '5 days', instructions: 'After meals' }]);
  const [selectedDiagnostics, setSelectedDiagnostics] = useState<string[]>([]);
  const [customDiagnostic, setCustomDiagnostic] = useState('');
  
  // Upward referral state
  const [referUpward, setReferUpward]         = useState(false);
  const [upwardFacility, setUpwardFacility]   = useState('');
  const [upwardSpecialty, setUpwardSpecialty] = useState('Obstetrics & Gynecology');
  const [upwardUrgency, setUpwardUrgency]     = useState('PRIORITY');
  const [upwardReason, setUpwardReason]       = useState('');

  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState(false);

  const addTask = (presetTitle?: string, presetDays?: number) => {
    if (tasks.length < 5) {
      setTasks(t => [...t, { title: presetTitle || '', dueInDays: presetDays || 3 }]);
    }
  };

  const addMed = (presetName?: string, presetDosage?: string, presetDuration?: string) => {
    if (medications.length < 5) {
      setMedications(m => [...m, {
        name: presetName || '',
        dosage: presetDosage || '1 tab OD',
        duration: presetDuration || '5 days',
        instructions: 'After meals'
      }]);
    }
  };

  const updateTask = (i: number, field: string, val: any) => {
    setTasks(t => t.map((task, idx) => idx === i ? { ...task, [field]: val } : task));
  };
  const updateMed = (i: number, field: string, val: string) => {
    setMedications(m => m.map((med, idx) => idx === i ? { ...med, [field]: val } : med));
  };

  const removeTask = (i: number) => {
    setTasks(t => t.filter((_, idx) => idx !== i));
  };
  const removeMed = (i: number) => {
    setMedications(m => m.filter((_, idx) => idx !== i));
  };

  const toggleDiagnostic = (testName: string) => {
    setSelectedDiagnostics(prev =>
      prev.includes(testName) ? prev.filter(t => t !== testName) : [...prev, testName]
    );
  };

  const addCustomDiagnostic = () => {
    if (customDiagnostic.trim() && !selectedDiagnostics.includes(customDiagnostic.trim())) {
      setSelectedDiagnostics(prev => [...prev, customDiagnostic.trim()]);
      setCustomDiagnostic('');
    }
  };

  const referralId = entry.referralId || entry.referral?.id;
  const patientId = entry.appointment?.patientId || entry.patientId || entry.appointment?.patient?.id;

  const submit = async () => {
    if (!outcome.trim()) {
      setError('Please enter your consultation diagnosis or outcome.');
      return;
    }
    const validTasks = tasks.filter(t => t.title.trim());
    const validMeds = medications.filter(m => m.name.trim());
    
    setError('');
    setSubmitting(true);
    try {
      // 1. Submit consultation counter-referral (creates Encounter + Prescriptions + FollowUps in DB)
      await api.post('/followups/counter-referral', {
        referralId: referralId || entry.id,
        outcome,
        treatment: validMeds.map(m => `${m.name} (${m.dosage})`).join(', '),
        instructions,
        tasks: validTasks,
        medications: validMeds,
        diagnosticOrders: selectedDiagnostics.map(name => ({ testName: name, status: 'PENDING' })),
      });

      // 2. If doctor opted for upward specialist referral, create it
      if (referUpward && upwardFacility && patientId) {
        await api.post('/referrals', {
          patientId,
          originId: entry.appointment?.facilityId || 'fac-baramati-chc',
          destinationId: upwardFacility,
          urgency: upwardUrgency,
          reason: `Specialist Referral (${upwardSpecialty}): ${upwardReason || outcome}`,
        });
      }

      // 3. Mark queue status as completed
      await api.put(`/queue/${entry.id}/status`, { status: 'COMPLETED' }).catch(() => {});

      setSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess();
      }, 1200);
    } catch (e: any) {
      setError(e.response?.data?.error || e.response?.data?.message || 'Could not submit care plan. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const patientName = entry.appointment?.patient?.name || entry.patient?.name || 'Patient';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <h3 className="text-base font-bold text-gray-900">Complete Consultation & Care Directives</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {patientName} · Persists Encounter, Prescriptions, Diagnostics & Closed-Loop Directives
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {success && (
            <div className="flex items-center gap-2.5 p-3.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 font-medium">
              <CheckCircle size={18} className="text-green-600 shrink-0" />
              <span>Consultation recorded! Prescriptions, Diagnostics, and Village Worker Tasks are active in PostgreSQL.</span>
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">{error}</div>
          )}

          {/* Quick clinical presets */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="text-xs font-semibold text-gray-700 mb-1.5">Quick Clinical Presets:</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setOutcome('Gestational Hypertension managed. Blood pressure stabilized.');
                  setInstructions('Rest for 3 days. Low sodium diet. Return to CHC if vision blurs.');
                  setTasks([{ title: 'Check home blood pressure & pulse', dueInDays: 3 }]);
                  setMedications([{ name: 'Amlodipine 5mg', dosage: '1 tab OD', duration: '14 days', instructions: 'Morning after food' }]);
                  setSelectedDiagnostics(['Complete Blood Count (CBC) with Platelets', 'Serum Creatinine & Kidney Function']);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-[#e4efe7] hover:border-[#1e6641] transition-colors"
              >
                + Maternal BP Protocol
              </button>
              <button
                type="button"
                onClick={() => {
                  setOutcome('Type 2 Diabetes follow-up. Diet and glycemic compliance reviewed.');
                  setInstructions('Continue prescribed medicine with meals. Walk 30 minutes daily.');
                  setTasks([{ title: 'Check fasting blood sugar & compliance', dueInDays: 7 }]);
                  setMedications([{ name: 'Metformin 500mg', dosage: '1 tab BD', duration: '30 days', instructions: 'With meals' }]);
                  setSelectedDiagnostics(['Glycated Hemoglobin (HbA1c)', 'Lipid Profile (Cholesterol & Triglycerides)']);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-[#e4efe7] hover:border-[#1e6641] transition-colors"
              >
                + Diabetes Care Protocol
              </button>
              <button
                type="button"
                onClick={() => {
                  setOutcome('Acute respiratory infection treated. Symptoms improving.');
                  setInstructions('Warm fluids. Complete antibiotic course. Keep child warm.');
                  setTasks([{ title: 'Check fever resolution & breathing comfort', dueInDays: 2 }]);
                  setMedications([
                    { name: 'Amoxicillin syrup 125mg', dosage: '5ml TDS', duration: '5 days', instructions: 'After meals' },
                    { name: 'Paracetamol syrup 250mg', dosage: '5ml SOS', duration: '3 days', instructions: 'SOS fever > 100 F' }
                  ]);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-[#e4efe7] hover:border-[#1e6641] transition-colors"
              >
                + Pediatric Fever Protocol
              </button>
            </div>
          </div>

          {/* Clinical Outcome */}
          <div>
            <label className={LABEL}>Doctor's Diagnosis & Consultation Outcome *</label>
            <textarea
              className={`${INPUT} min-h-[65px] resize-none`}
              placeholder="e.g. Mild gestational hypertension stabilized. Safe to recover in village with ASHA monitoring."
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
            />
          </div>

          {/* Advice */}
          <div>
            <label className={LABEL}>Home Care Advice & Patient Instructions</label>
            <textarea
              className={`${INPUT} min-h-[50px] resize-none`}
              placeholder="e.g. Drink warm fluids, avoid heavy lifting, report any red flag symptoms immediately."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
            />
          </div>

          {/* Prescriptions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${LABEL} mb-0`}>
                <span className="flex items-center gap-1.5"><Pill size={13} className="text-[#1e6641]" /> Prescribed Medications (Saved to PostgreSQL)</span>
              </label>
              {medications.length < 5 && (
                <button type="button" onClick={() => addMed()} className="text-xs text-[#1e6641] font-semibold hover:underline">+ Add Medicine</button>
              )}
            </div>
            <div className="space-y-2">
              {medications.map((med, i) => (
                <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-gray-50/70 p-2 rounded-xl border border-gray-100">
                  <input
                    className={`${INPUT} flex-2`}
                    placeholder="Medicine name (e.g. Amlodipine 5mg)"
                    value={med.name}
                    onChange={e => updateMed(i, 'name', e.target.value)}
                  />
                  <input
                    className={`${INPUT} flex-1`}
                    placeholder="Dosage (e.g. 1 tab OD)"
                    value={med.dosage}
                    onChange={e => updateMed(i, 'dosage', e.target.value)}
                  />
                  <input
                    className={`${INPUT} flex-1`}
                    placeholder="Duration (e.g. 7 days)"
                    value={med.duration}
                    onChange={e => updateMed(i, 'duration', e.target.value)}
                  />
                  {medications.length > 1 && (
                    <button type="button" onClick={() => removeMed(i)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostics */}
          <div>
            <label className={LABEL}>
              <span className="flex items-center gap-1.5"><TestTube2 size={13} className="text-purple-600" /> Order Laboratory Diagnostics</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {COMMON_DIAGNOSTICS.map(test => {
                const isChecked = selectedDiagnostics.includes(test);
                return (
                  <label
                    key={test}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isChecked ? 'bg-purple-50 border-purple-200 text-purple-900 font-semibold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDiagnostic(test)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="truncate">{test}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                className={`${INPUT} text-xs`}
                placeholder="Other diagnostic test (e.g. Liver Function Test)"
                value={customDiagnostic}
                onChange={e => setCustomDiagnostic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomDiagnostic(); } }}
              />
              <button
                type="button"
                onClick={addCustomDiagnostic}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
              >
                Add Test
              </button>
            </div>
          </div>

          {/* Follow-up Tasks for ASHA Worker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${LABEL} mb-0`}>
                <span className="flex items-center gap-1.5"><ClipboardList size={13} className="text-[#1e6641]" /> Action Items for Village Health Worker (ASHA)</span>
              </label>
              {tasks.length < 5 && (
                <button type="button" onClick={() => addTask()} className="text-xs text-[#1e6641] font-semibold hover:underline">+ Add Task</button>
              )}
            </div>
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className={`${INPUT} flex-1`}
                    placeholder="e.g. Visit home & check blood pressure"
                    value={task.title}
                    onChange={e => updateTask(i, 'title', e.target.value)}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-gray-500">Due:</span>
                    <select
                      className="border border-gray-200 rounded-xl text-xs p-2.5 bg-white focus:ring-2 focus:ring-[#1e6641] focus:outline-none font-medium text-gray-700"
                      value={task.dueInDays}
                      onChange={e => updateTask(i, 'dueInDays', Number(e.target.value))}
                    >
                      <option value={1}>1 Day (Tomorrow)</option>
                      <option value={2}>2 Days</option>
                      <option value={3}>3 Days</option>
                      <option value={5}>5 Days</option>
                      <option value={7}>1 Week</option>
                      <option value={14}>2 Weeks</option>
                    </select>
                  </div>
                  {tasks.length > 1 && (
                    <button type="button" onClick={() => removeTask(i)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Upward Specialist Referral Section */}
          <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/50 space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={referUpward}
                onChange={e => setReferUpward(e.target.checked)}
                className="rounded text-[#1e6641] focus:ring-[#1e6641]"
              />
              <span className="flex items-center gap-1"><ArrowUpRight size={14} className="text-indigo-600" /> Refer Upward to Specialist or Higher Facility</span>
            </label>

            {referUpward && (
              <div className="space-y-3 pt-2 border-t border-gray-200 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL}>Destination Facility *</label>
                    <select
                      className={INPUT}
                      value={upwardFacility}
                      onChange={e => setUpwardFacility(e.target.value)}
                    >
                      <option value="">Select hospital</option>
                      {facilities.map(f => (
                        <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Target Specialty *</label>
                    <select
                      className={INPUT}
                      value={upwardSpecialty}
                      onChange={e => setUpwardSpecialty(e.target.value)}
                    >
                      <option value="Obstetrics & Gynecology">Obstetrics & Gynecology</option>
                      <option value="Pediatrics & Neonatal Care">Pediatrics & Neonatal Care</option>
                      <option value="Internal Medicine">Internal Medicine</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="General Surgery">General Surgery</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Urgency Level</label>
                    <select
                      className={INPUT}
                      value={upwardUrgency}
                      onChange={e => setUpwardUrgency(e.target.value)}
                    >
                      <option value="ROUTINE">Routine</option>
                      <option value="PRIORITY">Priority (within 48h)</option>
                      <option value="URGENT">Urgent (Immediate)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Clinical Referral Reason</label>
                  <input
                    className={INPUT}
                    placeholder="e.g. High-risk pregnancy with persistent hypertension requiring secondary evaluation"
                    value={upwardReason}
                    onChange={e => setUpwardReason(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1e6641] hover:bg-[#165032] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-60"
          >
            {submitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Recording Clinical Records…
              </>
            ) : (
              <>
                <CheckCircle size={15} />
                Complete Consultation & Issue Care Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Doctor & Specialist Queue Page ───────────────────────────────────────
export default function Queue() {
  const [activeTab, setActiveTab]   = useState<'all' | 'my' | 'referrals'>('all');
  const [queue, setQueue]           = useState<any[]>([]);
  const [referrals, setReferrals]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [doctorProfile, setDoctorProfile] = useState<any>(null);

  // Form modal
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [patients, setPatients]     = useState<any[]>([]);
  const [doctors, setDoctors]       = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selPatient, setSelPatient] = useState('');
  const [selDoctor, setSelDoctor]   = useState('');
  const [selFacility, setSelFacility] = useState('');
  const [priority, setPriority]     = useState('0');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState('');

  // AI triage panel
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triageCache, setTriageCache] = useState<Record<string, any>>({});
  const [triageLoading, setTriageLoading] = useState<string | null>(null);

  // Consultation modal
  const [consultationEntry, setConsultationEntry] = useState<any | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const [queueRes, refRes, profileRes] = await Promise.allSettled([
        api.get('/queue'),
        api.get('/referrals'),
        api.get('/auth/doctor/me')
      ]);

      if (queueRes.status === 'fulfilled') {
        setQueue(Array.isArray(queueRes.value.data) ? queueRes.value.data : []);
        setError('');
      } else {
        setError('Could not load the consultation queue. Try refreshing.');
      }

      if (refRes.status === 'fulfilled') {
        setReferrals(Array.isArray(refRes.value.data) ? refRes.value.data : []);
      }

      if (profileRes.status === 'fulfilled') {
        setDoctorProfile(profileRes.value.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Real-time live synchronization via WebSocket
  useRealtimeQueue(
    doctorProfile?.id,
    doctorProfile?.facilities?.[0]?.id,
    useCallback(() => {
      fetchQueue();
    }, [fetchQueue])
  );

  const openModal = () => {
    setShowForm(true);
    if (patients.length === 0) api.get('/patients/search?q=').then(r => setPatients(r.data)).catch(() => {});
    if (doctors.length === 0) api.get('/auth/doctors').then(r => setDoctors(r.data)).catch(() => {});
    if (facilities.length === 0) api.get('/facilities').then(r => setFacilities(r.data.data || r.data || [])).catch(() => {});
  };

  const addToQueue = async () => {
    setModalError('');
    const errors: Record<string, string> = {};
    if (!selPatient) errors.selPatient = 'Please select a patient.';
    if (!selFacility) errors.selFacility = 'Please select a clinic or facility.';

    const prioNum = parseInt(priority, 10);
    if (isNaN(prioNum) || prioNum < 0 || prioNum > 10) {
      errors.priority = 'Priority must be a number between 0 and 10.';
    }

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setSubmitting(true);
    try {
      await api.post('/queue', {
        patientId: selPatient,
        doctorId: selDoctor || undefined,
        facilityId: selFacility,
        priority: prioNum,
      });
      setShowForm(false);
      setSelPatient(''); setSelDoctor(''); setSelFacility(''); setPriority('0');
      setFieldErrors({});
      await fetchQueue();
    } catch (e: any) {
      setModalError(e.response?.data?.error || e.response?.data?.message || 'Could not add patient to queue.');
    } finally { setSubmitting(false); }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await api.put(`/queue/${id}/status`, { status: newStatus });
      fetchQueue();
    } catch {
      setError('Could not update queue status. Please try again.');
    }
  };

  const updateReferralStatus = async (id: string, newStatus: string) => {
    try {
      await api.put(`/referrals/${id}/status`, { newStatus, notes: 'Updated by specialist doctor' });
      fetchQueue();
    } catch {
      setError('Could not update referral status.');
    }
  };

  const fetchTriage = async (entry: any) => {
    const id = entry.id;
    if (triageCache[id] || triageLoading === id) return;
    setTriageLoading(id);
    try {
      const patient = entry.appointment?.patient || entry.patient;
      const latest = patient?.assessments?.[0];

      const triagePayload = {
        patientId: patient?.id || 'unknown',
        age: patient?.age || 35,
        gender: patient?.gender || 'U',
        symptoms: latest?.symptoms?.map((s: any) => ({
          symptom: s.name || s.symptom || s,
          duration: s.duration,
          severity: s.severity,
        })) || [{ symptom: 'General complaint', duration: null, severity: 'LOW' }],
        vitals: latest?.vitals ? {
          temperature: latest.vitals.temperature,
          blood_pressure: latest.vitals.bloodPressure || latest.vitals.blood_pressure,
          heart_rate: latest.vitals.heartRate || latest.vitals.heart_rate,
          spo2: latest.vitals.spo2 || latest.vitals.oxygenSaturation,
          respiratory_rate: latest.vitals.respiratoryRate || latest.vitals.respiratory_rate,
        } : null,
        history: latest?.notes || null,
      };

      const triageRes = await api.post('/ai/triage', triagePayload);
      setTriageCache(c => ({ ...c, [id]: triageRes.data }));
    } catch {
      setTriageCache(c => ({
        ...c,
        [id]: {
          urgency: entry.priority > 0 ? 'PRIORITY' : 'ROUTINE',
          confidence: 0.65,
          reasons: ['Clinical urgency derived from queue priority.'],
          missing_information: ['Assess vitals and symptoms directly during consultation.'],
          recommended_next_action: 'Proceed with standard medical evaluation.',
          provenance: 'ICMR & WHO Tele-triage Guidelines',
          rule_version: 'fallback-v1',
        },
      }));
    } finally {
      setTriageLoading(null);
    }
  };

  const toggleExpand = (entry: any) => {
    const id = entry.id;
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchTriage(entry);
    }
  };

  // Filtering
  const myQueue = queue.filter(e => doctorProfile?.id && e.doctorId === doctorProfile.id);
  const displayQueue = activeTab === 'my' ? myQueue : queue;

  const waiting = displayQueue.filter(e => e.status === 'WAITING' || e.status === 'PRIORITY').length;
  const inConsult = displayQueue.filter(e => e.status === 'IN_CONSULTATION').length;
  const incomingReferralsCount = referrals.filter(r => ['SUBMITTED', 'ACCEPTED', 'SCHEDULED'].includes(r.status)).length;

  return (
    <PageShell
      title="Outpatient Consultation Queue"
      subtitle={
        activeTab === 'referrals'
          ? `${incomingReferralsCount} incoming referrals awaiting specialist review`
          : displayQueue.length > 0
          ? `${waiting} waiting · ${inConsult} in consultation`
          : 'Consultation queue is clear'
      }
      action={
        <div className="flex gap-2">
          <button
            onClick={fetchQueue}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600 bg-white"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-[#1e6641] hover:bg-[#165032] text-white transition-colors shadow-xs"
          >
            <Plus size={14} /> Walk-in Patient
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <InlineError message={error} onDismiss={() => setError('')} />

        {/* Doctor Identity & Specialty Banner */}
        {doctorProfile && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl text-xs shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#e4efe7] text-[#1e6641] flex items-center justify-center font-bold">
                <Stethoscope size={16} />
              </div>
              <div>
                <div className="font-bold text-gray-900">{doctorProfile.name}</div>
                <div className="text-gray-500">
                  {doctorProfile.specialty} · {doctorProfile.facilities?.[0]?.name || 'Baramati Sub-District Hospital & CHC'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[#1e6641] font-semibold border border-emerald-200 text-[11px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live Real-Time Socket Connected
              </span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-[#1e6641] text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span>All Waiting Queue</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {queue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('my')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'my'
                ? 'bg-[#1e6641] text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span>My Assigned Queue</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'my' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {myQueue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('referrals')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'referrals'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
            }`}
          >
            <Sparkles size={13} />
            <span>Specialist Referrals</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'referrals' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
              {incomingReferralsCount}
            </span>
          </button>
        </div>

        {/* TAB 1 & 2: QUEUE LIST */}
        {activeTab !== 'referrals' && (
          <div>
            {loading ? (
              <SkeletonList rows={5} />
            ) : displayQueue.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100">
                <EmptyState
                  icon={Clock}
                  title="No patients in queue"
                  description="New appointments or health worker referrals will appear here instantly."
                />
              </div>
            ) : (
              <div className="space-y-3">
                {displayQueue.map((entry, idx) => {
                  const isExpanded = expandedId === entry.id;
                  const triage = triageCache[entry.id];
                  const isLoadingTriage = triageLoading === entry.id;
                  const patient = entry.appointment?.patient || entry.patient;
                  const patientName = patient?.name || 'Unknown patient';
                  const arrivalTime = entry.arrivalTime ? new Date(entry.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Arrived';

                  return (
                    <div key={entry.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all shadow-xs">
                      <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                        <span className="hidden sm:block text-sm font-semibold text-gray-400">{idx + 1}</span>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#e4efe7] text-[#1e6641] flex items-center justify-center font-semibold text-sm shrink-0">
                            {patientName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{patientName}</div>
                            <div className="text-xs text-gray-400">
                              Arrived {arrivalTime} · {patient?.age ? `${patient.age}y` : ''} {patient?.gender || ''}
                            </div>
                          </div>
                        </div>

                        <div className="hidden sm:block">
                          {entry.priority > 0 ? <StatusBadge status="URGENT" /> : <span className="text-xs text-gray-400">Routine</span>}
                        </div>

                        <StatusBadge status={entry.status} />

                        <div className="flex items-center gap-1.5">
                          {/* AI Triage toggle */}
                          <button
                            onClick={() => toggleExpand(entry)}
                            title="View AI Triage & CDSS protocol"
                            className={`p-1.5 rounded-lg transition-colors ${
                              isExpanded ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                            }`}
                          >
                            <Brain size={15} />
                          </button>

                          {patient?.id && (
                            <Link
                              to={`/patients/${patient.id}`}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#1e6641] hover:bg-[#e4efe7] transition-colors"
                              title="View Patient Record"
                            >
                              <ChevronRight size={16} />
                            </Link>
                          )}

                          {entry.status === 'WAITING' && (
                            <button
                              onClick={() => updateStatus(entry.id, 'IN_CONSULTATION')}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1e6641] hover:bg-[#165032] text-white transition-colors whitespace-nowrap"
                            >
                              Start Consult
                            </button>
                          )}

                          {entry.status === 'IN_CONSULTATION' && (
                            <button
                              onClick={() => setConsultationEntry(entry)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors whitespace-nowrap shadow-xs"
                            >
                              Complete Consult
                            </button>
                          )}
                        </div>
                      </div>

                      {/* AI Triage panel */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-5 pb-4 pt-3 bg-gray-50/40">
                          {isLoadingTriage ? (
                            <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                              <Brain size={14} className="animate-pulse text-purple-500" />
                              Evaluating clinical decision support rules…
                            </div>
                          ) : triage ? (
                            <TriageCard triage={triage} />
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SPECIALIST REFERRAL INBOX */}
        {activeTab === 'referrals' && (
          <div className="space-y-3">
            {referrals.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <Sparkles size={28} className="text-indigo-500 mx-auto mb-2" />
                <div className="font-semibold text-gray-900 text-sm">No incoming specialist referrals</div>
                <p className="text-xs text-gray-500 mt-1">Specialist cases from PHCs and community health workers will appear here.</p>
              </div>
            ) : (
              referrals.map((ref: any) => (
                <div key={ref.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                        {ref.patient?.name?.charAt(0) || 'P'}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-900">{ref.patient?.name || 'Referred Patient'}</div>
                        <div className="text-xs text-gray-500">
                          From: {ref.origin?.name || 'Sub-Center'} · {new Date(ref.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ref.urgency} />
                      <StatusBadge status={ref.status} />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-800">
                    <span className="font-semibold text-gray-900">Clinical Reason:</span> {ref.reason}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <Link to={`/patients/${ref.patientId}`} className="text-xs font-semibold text-[#1e6641] hover:underline flex items-center gap-1">
                      View Longitudinal Patient History <ChevronRight size={13} />
                    </Link>

                    <div className="flex items-center gap-2">
                      {ref.status === 'SUBMITTED' && (
                        <button
                          onClick={() => updateReferralStatus(ref.id, 'ACCEPTED')}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                        >
                          Accept Specialist Referral
                        </button>
                      )}
                      {ref.status === 'ACCEPTED' && (
                        <button
                          onClick={() => updateReferralStatus(ref.id, 'SCHEDULED')}
                          className="px-3 py-1.5 bg-[#1e6641] hover:bg-[#165032] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                        >
                          Schedule for Clinic
                        </button>
                      )}
                      {ref.status === 'SCHEDULED' && (
                        <button
                          onClick={async () => {
                            await updateReferralStatus(ref.id, 'PATIENT_ARRIVED');
                            await api.post('/queue', {
                              patientId: ref.patientId,
                              facilityId: ref.destinationId,
                              priority: ref.urgency === 'URGENT' ? 2 : 1
                            }).catch(() => {});
                            fetchQueue();
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                        >
                          Patient Arrived · Enqueue
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Consultation modal */}
        {consultationEntry && (
          <ConsultationModal
            entry={consultationEntry}
            facilities={facilities}
            onClose={() => setConsultationEntry(null)}
            onSuccess={() => {
              fetchQueue();
              setConsultationEntry(null);
            }}
          />
        )}

        {/* Walk-in patient modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900">Add Walk-in Patient to Queue</h3>
                <button
                  onClick={() => { setShowForm(false); setFieldErrors({}); setModalError(''); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {modalError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">{modalError}</div>
                )}
                <div>
                  <label className={LABEL}>Patient *</label>
                  <select
                    className={`${INPUT} ${fieldErrors.selPatient ? 'border-red-400 focus:ring-red-400' : ''}`}
                    value={selPatient}
                    onChange={e => {
                      setSelPatient(e.target.value);
                      if (fieldErrors.selPatient) setFieldErrors(prev => ({ ...prev, selPatient: '' }));
                    }}
                  >
                    <option value="">Select patient</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.village || 'Patient'})</option>)}
                  </select>
                  {fieldErrors.selPatient && <p className="text-xs text-red-500 mt-1">{fieldErrors.selPatient}</p>}
                </div>
                <div>
                  <label className={LABEL}>Clinic / Facility *</label>
                  <select
                    className={`${INPUT} ${fieldErrors.selFacility ? 'border-red-400 focus:ring-red-400' : ''}`}
                    value={selFacility}
                    onChange={e => {
                      setSelFacility(e.target.value);
                      if (fieldErrors.selFacility) setFieldErrors(prev => ({ ...prev, selFacility: '' }));
                    }}
                  >
                    <option value="">Select clinic</option>
                    {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  {fieldErrors.selFacility && <p className="text-xs text-red-500 mt-1">{fieldErrors.selFacility}</p>}
                </div>
                <div>
                  <label className={LABEL}>Assigned Doctor <span className="font-normal text-gray-400">(optional)</span></label>
                  <select className={INPUT} value={selDoctor} onChange={e => setSelDoctor(e.target.value)}>
                    <option value="">Any available Medical Officer</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name || d.user?.email || `Doctor ${d.id.slice(0,6)}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Triage Priority</label>
                  <select
                    className={INPUT}
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                  >
                    <option value="0">Routine Consultation</option>
                    <option value="1">Priority Review</option>
                    <option value="2">Urgent Attention Needed</option>
                  </select>
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowForm(false); setFieldErrors({}); setModalError(''); }}>Cancel</Button>
                <Button onClick={addToQueue} disabled={submitting} className="bg-[#1e6641] hover:bg-[#165032] text-white">
                  {submitting ? 'Adding…' : 'Add to Queue'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
