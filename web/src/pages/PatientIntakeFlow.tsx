import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import { enqueueMutation } from '../lib/db';
import {
  User, Activity, ArrowRight, ArrowLeft,
  Building2, Ambulance,
  CheckCircle2, Search, ShieldCheck, AlertTriangle,
  Stethoscope
} from 'lucide-react';

const COMMON_SYMPTOMS = [
  'High Fever', 'Dry Cough', 'Shortness of Breath', 'Chest Pain',
  'Dizziness', 'Severe Headache', 'Stomach Pain', 'Vomiting',
  'Joint Pain', 'Weakness / Fatigue', 'High Blood Pressure', 'Blurred Vision'
];

const STEPS = [
  { n: 1, label: 'Patient Identification' },
  { n: 2, label: 'Vitals & Symptoms' },
  { n: 3, label: 'Clinical Triage & Approval' },
  { n: 4, label: 'Facility Routing & Referral' },
];

const INPUT = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1e6641] focus:outline-none bg-white';
const LABEL = 'block text-xs font-semibold text-gray-700 mb-1.5';

interface SelectedSymptom {
  name: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  duration: string;
}

export default function PatientIntakeFlow() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(parseInt(searchParams.get('step') || '1', 10));

  // Patient Mode: 'EXISTING' | 'NEW'
  const [patientMode, setPatientMode] = useState<'EXISTING' | 'NEW'>('NEW');
  const [patientSearch, setPatientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Patient demographics
  const [patient, setPatient] = useState({
    name: '',
    age: '',
    gender: 'FEMALE',
    phone: '',
    village: 'Khandala Sub-center',
    abhaId: ''
  });

  // Vitals
  const [vitals, setVitals] = useState({
    bpSystolic: '120',
    bpDiastolic: '80',
    heartRate: '78',
    spO2: '98',
    temperature: '98.6',
    bloodGlucose: '',
    respiratoryRate: '18'
  });

  // Structured Symptoms
  const [symptoms, setSymptoms] = useState<SelectedSymptom[]>([]);

  // Triage & Decision Support
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<{
    urgency: string;
    confidence: number;
    reasons: string[];
    risk_factors: string[];
    missing_information: string[];
    recommended_next_action: string;
    provenance: string;
  } | null>(null);

  // Frontline Human Approval of AI Recommendation
  const [humanDecision, setHumanDecision] = useState<'ACCEPT' | 'MODIFY' | 'REJECT'>('ACCEPT');
  const [modifiedUrgency, setModifiedUrgency] = useState('ROUTINE');
  const [decisionReason, setDecisionReason] = useState('');

  // Routing & Referral
  const [facilities, setFacilities] = useState<any[]>([]);
  const [rankedFacilities, setRankedFacilities] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [referralNotes, setReferralNotes] = useState('');
  const [needsAmbulance, setNeedsAmbulance] = useState(false);

  // Execution states
  const [submitting, setSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  // Load facilities & initial routing
  useEffect(() => {
    api.get('/facilities').then(r => {
      const facs = r.data.data || r.data || [];
      setFacilities(facs);
      if (facs.length) setSelectedFacility(facs[0].id);
    }).catch(() => {});
  }, []);

  // Search existing patients
  const handleSearchExisting = async (query: string) => {
    setPatientSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/patients/search?q=${encodeURIComponent(query.trim())}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setSearchResults(list.slice(0, 5));
    } catch {
      setSearchResults([]);
    }
  };

  const selectExistingPatient = (pat: any) => {
    setSelectedPatientId(pat.id);
    setPatient({
      name: pat.name || '',
      age: pat.age ? String(pat.age) : '',
      gender: pat.gender || 'FEMALE',
      phone: pat.phone || '',
      village: pat.village || '',
      abhaId: pat.identifiers?.[0]?.value || ''
    });
    setStepErrors({});
  };

  const toggleSymptom = (name: string) => {
    setStepErrors(prev => { const copy = { ...prev }; delete copy.symptoms; return copy; });
    setSymptoms(prev => {
      const exists = prev.find(s => s.name === name);
      if (exists) {
        return prev.filter(s => s.name !== name);
      } else {
        return [...prev, { name, severity: 'MODERATE', duration: '1-2 days' }];
      }
    });
  };

  const updateSymptomSeverity = (name: string, severity: 'MILD' | 'MODERATE' | 'SEVERE') => {
    setSymptoms(prev => prev.map(s => s.name === name ? { ...s, severity } : s));
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (patientMode === 'EXISTING') {
      if (!selectedPatientId) {
        errs.existing = 'Please search and select a community patient from the list';
      }
    } else {
      const cleanName = (patient.name || '').trim();
      if (!cleanName) {
        errs.name = 'Patient full name is required';
      } else if (cleanName.length < 2) {
        errs.name = 'Name must be at least 2 characters long';
      }

      if (!patient.age) {
        errs.age = 'Age is required';
      } else {
        const ageNum = parseInt(patient.age, 10);
        if (isNaN(ageNum) || ageNum < 0 || ageNum > 125) {
          errs.age = 'Enter a valid age between 0 and 125';
        }
      }

      if (patient.phone) {
        const digits = patient.phone.replace(/\D/g, '');
        if (digits.length < 10) {
          errs.phone = 'Phone number must be at least 10 digits';
        }
      }

      if (patient.abhaId) {
        const abhaClean = patient.abhaId.trim();
        if (!/^\d{2}-\d{4}-\d{4}-\d{4}$|^\d{14}$/.test(abhaClean)) {
          errs.abhaId = 'ABHA ID must be 14 digits (e.g., 91-8844-3321-0012)';
        }
      }
    }

    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 2 Validation (Vitals & Symptoms)
  const validateStep2 = () => {
    const errs: Record<string, string> = {};

    if (vitals.bpSystolic) {
      const sys = parseFloat(vitals.bpSystolic);
      if (isNaN(sys) || sys < 50 || sys > 280) {
        errs.bpSystolic = 'Systolic BP must be between 50 and 280 mmHg';
      }
    }
    if (vitals.bpDiastolic) {
      const dia = parseFloat(vitals.bpDiastolic);
      if (isNaN(dia) || dia < 30 || dia > 180) {
        errs.bpDiastolic = 'Diastolic BP must be between 30 and 180 mmHg';
      }
    }
    if (vitals.spO2) {
      const spo2 = parseFloat(vitals.spO2);
      if (isNaN(spo2) || spo2 < 40 || spo2 > 100) {
        errs.spO2 = 'SpO2 must be between 40% and 100% (impossible physiological value)';
      }
    }
    if (vitals.heartRate) {
      const hr = parseFloat(vitals.heartRate);
      if (isNaN(hr) || hr < 30 || hr > 250) {
        errs.heartRate = 'Heart rate must be between 30 and 250 bpm';
      }
    }
    if (vitals.temperature) {
      const temp = parseFloat(vitals.temperature);
      if (isNaN(temp) || temp < 85 || temp > 115) {
        errs.temperature = 'Temperature must be between 85°F and 115°F';
      }
    }
    if (vitals.bloodGlucose) {
      const bg = parseFloat(vitals.bloodGlucose);
      if (isNaN(bg) || bg < 20 || bg > 700) {
        errs.bloodGlucose = 'Blood glucose must be between 20 and 700 mg/dL';
      }
    }
    if (vitals.respiratoryRate) {
      const rr = parseFloat(vitals.respiratoryRate);
      if (isNaN(rr) || rr < 8 || rr > 60) {
        errs.respiratoryRate = 'Respiratory rate must be between 8 and 60 breaths/min';
      }
    }

    if (symptoms.length === 0) {
      errs.symptoms = 'Please select at least one clinical symptom';
    }

    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Run AI Clinical Triage
  const runClinicalTriage = async () => {
    if (!validateStep2()) return;

    setTriageLoading(true);
    setApiError('');

    try {
      const triagePayload = {
        patientId: selectedPatientId || 'new-patient',
        age: parseInt(patient.age || '35', 10),
        gender: patient.gender,
        symptoms: symptoms.map(s => ({ name: s.name, severity: s.severity, duration: s.duration })),
        vitals: {
          bpSystolic: vitals.bpSystolic,
          bpDiastolic: vitals.bpDiastolic,
          spo2: vitals.spO2,
          heart_rate: vitals.heartRate,
          temperature: vitals.temperature,
          respiratory_rate: vitals.respiratoryRate,
          glucose: vitals.bloodGlucose || undefined
        }
      };

      const res = await api.post('/ai/triage', triagePayload);
      setTriageResult(res.data);
      setModifiedUrgency(res.data.urgency || 'ROUTINE');

      // Also trigger route calculation
      const routeRes = await api.post('/ai/route', {
        urgency: res.data.urgency,
        requiredSpecialty: symptoms.some(s => s.name.includes('Chest')) ? 'Cardiology' : undefined
      }).catch(() => null);

      if (routeRes?.data?.ranked_facilities) {
        setRankedFacilities(routeRes.data.ranked_facilities);
        const firstEligible = routeRes.data.ranked_facilities.find((f: any) => f.eligible !== false);
        if (firstEligible) {
          setSelectedFacility(firstEligible.facility_id || firstEligible.id);
        } else if (routeRes.data.ranked_facilities.length > 0) {
          setSelectedFacility(routeRes.data.ranked_facilities[0].facility_id || routeRes.data.ranked_facilities[0].id);
        }
      }

      setStep(3);
    } catch (err: any) {
      setApiError(err.response?.data?.message || 'Clinical triage evaluation failed.');
    } finally {
      setTriageLoading(false);
    }
  };

  // Final Submission to PostgreSQL
  const handleSubmit = async () => {
    setSubmitting(true);
    setApiError('');
    const isOffline = !navigator.onLine;

    const finalUrgency = humanDecision === 'MODIFY' ? modifiedUrgency : (triageResult?.urgency || 'ROUTINE');

    // Structured vitals array
    const rawVitalsList = [
      { type: 'BP_SYSTOLIC', value: vitals.bpSystolic, unit: 'mmHg' },
      { type: 'BP_DIASTOLIC', value: vitals.bpDiastolic, unit: 'mmHg' },
      { type: 'SPO2', value: vitals.spO2, unit: '%' },
      { type: 'HEART_RATE', value: vitals.heartRate, unit: 'bpm' },
      { type: 'TEMP', value: vitals.temperature, unit: '°F' },
    ];
    if (vitals.bloodGlucose) {
      rawVitalsList.push({ type: 'GLUCOSE', value: vitals.bloodGlucose, unit: 'mg/dL' });
    }
    if (vitals.respiratoryRate) {
      rawVitalsList.push({ type: 'RESPIRATORY_RATE', value: vitals.respiratoryRate, unit: 'breaths/min' });
    }

    if (isOffline) {
      // ── OFFLINE PATH: Queue in Dexie ──
      try {
        const offlinePatId = selectedPatientId || `offline-pat-${Date.now()}`;
        if (!selectedPatientId) {
          await enqueueMutation('PATIENT', 'CREATE', {
            id: offlinePatId,
            name: patient.name,
            age: parseInt(patient.age || '30', 10),
            gender: patient.gender,
            phone: patient.phone || undefined,
            village: patient.village || undefined
          });
        }

        const offlineEncId = `offline-enc-${Date.now()}`;
        await enqueueMutation('ENCOUNTER', 'CREATE', {
          id: offlineEncId,
          patientId: offlinePatId,
          type: 'FIELD_VISIT',
          status: 'IN_PROGRESS'
        });

        await enqueueMutation('ASSESSMENT', 'CREATE', {
          patientId: offlinePatId,
          encounterId: offlineEncId,
          symptoms: symptoms.map(s => ({ name: s.name, severity: s.severity, duration: s.duration })),
          vitals: rawVitalsList,
          provenance: 'WORKER_RECORDED'
        });

        const offlineRefId = `offline-ref-${Date.now()}`;
        await enqueueMutation('REFERRAL', 'CREATE', {
          id: offlineRefId,
          patientId: offlinePatId,
          destinationId: selectedFacility || 'fac-baramati-chc',
          urgency: finalUrgency,
          reason: referralNotes || symptoms.map(s => s.name).join(', ')
        });

        navigate('/referral-success', {
          state: {
            token: offlineRefId,
            patientName: patient.name,
            urgency: finalUrgency,
            facilityName: facilities.find(f => f.id === selectedFacility)?.name || 'Baramati CHC',
            needsAmbulance,
            isOffline: true
          }
        });
      } catch (err: any) {
        setApiError('Offline queue failed: ' + err.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── ONLINE PATH: PostgreSQL Endpoints ──
    try {
      let activePatientId = selectedPatientId;

      // 1. If registering new patient, create patient in DB
      if (!activePatientId) {
        const patRes = await api.post('/patients', {
          name: patient.name.trim(),
          age: parseInt(patient.age, 10),
          gender: patient.gender,
          phone: patient.phone.trim() || undefined,
          village: patient.village.trim() || undefined,
          abhaId: patient.abhaId.trim() || undefined
        });
        activePatientId = patRes.data.id;
      }

      // 2. Create Assessment (which automatically provisions Encounter & Vitals in PostgreSQL)
      const assRes = await api.post('/assessments', {
        patientId: activePatientId,
        symptoms: symptoms.map(s => ({
          name: s.name,
          severity: s.severity,
          duration: s.duration
        })),
        vitals: rawVitalsList,
        observations: referralNotes || 'ASHA frontline field encounter',
        provenance: 'WORKER_RECORDED'
      });

      const assessmentId = assRes.data.id;

      // 3. Confirm Human Decision on Triage Recommendation
      if (assessmentId) {
        await api.patch(`/assessments/${assessmentId}/triage/confirm`, {
          decision: humanDecision,
          confirmedUrgency: finalUrgency,
          overrideReason: decisionReason || undefined
        }).catch(() => {});
      }

      // 4. Create Referral in PostgreSQL
      const refRes = await api.post('/referrals', {
        patientId: activePatientId,
        destinationId: selectedFacility,
        urgency: finalUrgency,
        reason: referralNotes || symptoms.map(s => s.name).join(', ')
      });

      const createdReferral = refRes.data;

      // Navigate to success screen with real database referral ID
      navigate('/referral-success', {
        state: {
          token: createdReferral.id,
          patientName: patient.name,
          urgency: finalUrgency,
          facilityName: facilities.find(f => f.id === selectedFacility)?.name || 'Baramati CHC',
          needsAmbulance,
          isOffline: false
        }
      });
    } catch (err: any) {
      console.error('Patient intake flow error:', err);
      setApiError(err.response?.data?.message || err.response?.data?.error || 'Failed to complete patient intake.');
    } finally {
      setSubmitting(false);
    }
  };

  const pct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16 animate-page-in">
      {/* Step Indicator */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`flex items-center gap-1.5 ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                step > s.n ? 'bg-[#1e6641] text-white' : step === s.n ? 'bg-[#1e6641] text-white ring-4 ring-[#1e6641]/10' : 'bg-gray-100 text-gray-400'
              }`}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${step === s.n ? 'text-[#1e6641]' : 'text-gray-400'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-100 mx-2" />}
            </div>
          ))}
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#1e6641] rounded-full transition-all duration-300" style={{ width: `${step === 1 ? 8 : pct}%` }} />
        </div>
      </div>

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-medium flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0 text-red-600" />
          {apiError}
        </div>
      )}

      {/* ── STEP 1: Patient Identification ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-gray-50 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#e4efe7] text-[#1e6641] flex items-center justify-center">
                <User size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Patient Identification</h2>
                <p className="text-xs text-gray-500">Select an existing community member or register a new patient</p>
              </div>
            </div>

            <div className="flex rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => { setPatientMode('NEW'); setSelectedPatientId(null); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  patientMode === 'NEW' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                New Registration
              </button>
              <button
                type="button"
                onClick={() => setPatientMode('EXISTING')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  patientMode === 'EXISTING' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Existing Patient
              </button>
            </div>
          </div>

          {patientMode === 'EXISTING' ? (
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Search Community Registry (Name, Mobile, or ABHA)</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={e => handleSearchExisting(e.target.value)}
                    placeholder="Type name, 10-digit phone, or village..."
                    className={`${INPUT} pl-10`}
                  />
                </div>
                {stepErrors.existing && <p className="text-xs text-red-600 mt-1">{stepErrors.existing}</p>}
              </div>

              {searchResults.length > 0 && (
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectExistingPatient(p)}
                      className={`w-full p-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors ${
                        selectedPatientId === p.id ? 'bg-[#e4efe7]/40 border-l-4 border-[#1e6641]' : ''
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">
                          {p.age} yrs · {p.gender} · {p.village || 'No village specified'} · {p.phone || 'No phone'}
                        </div>
                      </div>
                      {selectedPatientId === p.id && (
                        <CheckCircle2 size={18} className="text-[#1e6641]" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {selectedPatientId && (
                <div className="p-3 bg-[#e4efe7]/30 border border-[#1e6641]/20 rounded-xl text-xs text-[#1e6641] font-medium flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  Selected: <strong>{patient.name}</strong> ({patient.age} yrs, {patient.gender}, {patient.village})
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Full Name *</label>
                <input
                  type="text"
                  value={patient.name}
                  onChange={e => setPatient({ ...patient, name: e.target.value })}
                  placeholder="e.g. Vandana Kulkarni"
                  className={`${INPUT} ${stepErrors.name ? 'border-red-400 bg-red-50/20' : ''}`}
                />
                {stepErrors.name && <p className="text-xs text-red-600 mt-1">{stepErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Age *</label>
                  <input
                    type="number"
                    min="0"
                    max="125"
                    value={patient.age}
                    onChange={e => setPatient({ ...patient, age: e.target.value })}
                    placeholder="e.g. 28"
                    className={`${INPUT} ${stepErrors.age ? 'border-red-400 bg-red-50/20' : ''}`}
                  />
                  {stepErrors.age && <p className="text-xs text-red-600 mt-1">{stepErrors.age}</p>}
                </div>
                <div>
                  <label className={LABEL}>Gender *</label>
                  <select
                    value={patient.gender}
                    onChange={e => setPatient({ ...patient, gender: e.target.value })}
                    className={INPUT}
                  >
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Mobile Number (Optional)</label>
                  <input
                    type="tel"
                    value={patient.phone}
                    onChange={e => setPatient({ ...patient, phone: e.target.value })}
                    placeholder="e.g. +91 98220 12345"
                    className={`${INPUT} ${stepErrors.phone ? 'border-red-400 bg-red-50/20' : ''}`}
                  />
                  {stepErrors.phone && <p className="text-xs text-red-600 mt-1">{stepErrors.phone}</p>}
                </div>
                <div>
                  <label className={LABEL}>Village / Ward</label>
                  <input
                    type="text"
                    value={patient.village}
                    onChange={e => setPatient({ ...patient, village: e.target.value })}
                    placeholder="e.g. Khandala Ward 3"
                    className={INPUT}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL}>Ayushman Bharat Health Account (ABHA ID) — Optional</label>
                <input
                  type="text"
                  value={patient.abhaId}
                  onChange={e => setPatient({ ...patient, abhaId: e.target.value })}
                  placeholder="e.g. 91-8844-3321-0012 (leave blank if unavailable)"
                  className={`${INPUT} ${stepErrors.abhaId ? 'border-red-400 bg-red-50/20' : ''}`}
                />
                <p className="text-[11px] text-gray-400 mt-1">If unavailable, patient will be registered under local community ID.</p>
                {stepErrors.abhaId && <p className="text-xs text-red-600 mt-1">{stepErrors.abhaId}</p>}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-50">
            <Button
              type="button"
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
              className="bg-[#1e6641] hover:bg-[#165032] text-white flex items-center gap-1.5"
            >
              Continue to Vitals <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Vitals & Symptoms ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6 shadow-xs">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
            <div className="w-10 h-10 rounded-xl bg-[#e4efe7] text-[#1e6641] flex items-center justify-center">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Health Measurements & Symptoms</h2>
              <p className="text-xs text-gray-500">Record genuine clinical vitals and reported symptoms for {patient.name || 'patient'}</p>
            </div>
          </div>

          {/* Vitals Grid */}
          <div>
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Field Vitals</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>BP (Systolic)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={vitals.bpSystolic}
                    onChange={e => setVitals({ ...vitals, bpSystolic: e.target.value })}
                    className={`${INPUT} ${stepErrors.bpSystolic ? 'border-red-400' : ''}`}
                    placeholder="120"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">mmHg</span>
                </div>
                {stepErrors.bpSystolic && <p className="text-[11px] text-red-600 mt-1">{stepErrors.bpSystolic}</p>}
              </div>

              <div>
                <label className={LABEL}>BP (Diastolic)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={vitals.bpDiastolic}
                    onChange={e => setVitals({ ...vitals, bpDiastolic: e.target.value })}
                    className={`${INPUT} ${stepErrors.bpDiastolic ? 'border-red-400' : ''}`}
                    placeholder="80"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">mmHg</span>
                </div>
                {stepErrors.bpDiastolic && <p className="text-[11px] text-red-600 mt-1">{stepErrors.bpDiastolic}</p>}
              </div>

              <div>
                <label className={LABEL}>Oxygen Saturation (SpO2)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={vitals.spO2}
                    onChange={e => setVitals({ ...vitals, spO2: e.target.value })}
                    className={`${INPUT} ${stepErrors.spO2 ? 'border-red-400' : ''}`}
                    placeholder="98"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">%</span>
                </div>
                {stepErrors.spO2 && <p className="text-[11px] text-red-600 mt-1">{stepErrors.spO2}</p>}
              </div>

              <div>
                <label className={LABEL}>Heart Rate / Pulse</label>
                <div className="relative">
                  <input
                    type="number"
                    value={vitals.heartRate}
                    onChange={e => setVitals({ ...vitals, heartRate: e.target.value })}
                    className={`${INPUT} ${stepErrors.heartRate ? 'border-red-400' : ''}`}
                    placeholder="78"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">bpm</span>
                </div>
                {stepErrors.heartRate && <p className="text-[11px] text-red-600 mt-1">{stepErrors.heartRate}</p>}
              </div>

              <div>
                <label className={LABEL}>Body Temperature</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={vitals.temperature}
                    onChange={e => setVitals({ ...vitals, temperature: e.target.value })}
                    className={`${INPUT} ${stepErrors.temperature ? 'border-red-400' : ''}`}
                    placeholder="98.6"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">°F</span>
                </div>
                {stepErrors.temperature && <p className="text-[11px] text-red-600 mt-1">{stepErrors.temperature}</p>}
              </div>

              <div>
                <label className={LABEL}>Blood Glucose (Optional)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={vitals.bloodGlucose}
                    onChange={e => setVitals({ ...vitals, bloodGlucose: e.target.value })}
                    className={`${INPUT} ${stepErrors.bloodGlucose ? 'border-red-400' : ''}`}
                    placeholder="e.g. 140"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">mg/dL</span>
                </div>
                {stepErrors.bloodGlucose && <p className="text-[11px] text-red-600 mt-1">{stepErrors.bloodGlucose}</p>}
              </div>
            </div>
          </div>

          {/* Structured Symptoms */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Reported Symptoms</h3>
              <span className="text-xs text-gray-400">Select all that apply</span>
            </div>

            {stepErrors.symptoms && (
              <p className="text-xs text-red-600 mb-2 font-medium">{stepErrors.symptoms}</p>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              {COMMON_SYMPTOMS.map(sym => {
                const isSelected = symptoms.some(s => s.name === sym);
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => toggleSymptom(sym)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-[#1e6641] text-white border-[#1e6641] shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {isSelected ? `✓ ${sym}` : `+ ${sym}`}
                  </button>
                );
              })}
            </div>

            {/* Severity and Duration for Selected Symptoms */}
            {symptoms.length > 0 && (
              <div className="space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                <div className="text-xs font-bold text-gray-700 mb-2">Symptom Severity & Duration</div>
                {symptoms.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-xs flex-wrap gap-2 p-2 bg-white rounded-lg border border-gray-100">
                    <span className="font-semibold text-gray-800">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={s.severity}
                        onChange={e => updateSymptomSeverity(s.name, e.target.value as any)}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white font-medium"
                      >
                        <option value="MILD">Mild</option>
                        <option value="MODERATE">Moderate</option>
                        <option value="SEVERE">Severe</option>
                      </select>
                      <input
                        type="text"
                        value={s.duration}
                        onChange={e => {
                          const val = e.target.value;
                          setSymptoms(prev => prev.map(item => item.name === s.name ? { ...item, duration: val } : item));
                        }}
                        placeholder="Duration (e.g. 2 days)"
                        className="text-xs border border-gray-200 rounded-md px-2 py-1 w-28 bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-50">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              className="text-xs flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back
            </Button>
            <Button
              type="button"
              onClick={runClinicalTriage}
              disabled={triageLoading}
              className="bg-[#1e6641] hover:bg-[#165032] text-white flex items-center gap-1.5"
            >
              {triageLoading ? 'Evaluating Triage...' : <>Run Clinical Triage <ArrowRight size={14} /></>}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Clinical Triage & Frontline Approval ── */}
      {step === 3 && triageResult && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Clinical Decision Support & Frontline Review</h2>
                <p className="text-xs text-gray-500">ICMR / WHO Clinical Heuristics — Requires frontline health worker confirmation</p>
              </div>
            </div>
            <StatusBadge status={triageResult.urgency} />
          </div>

          {/* Triage Findings Box */}
          <div className={`p-5 rounded-2xl border ${
            triageResult.urgency === 'URGENT' ? 'bg-red-50/50 border-red-200' : triageResult.urgency === 'PRIORITY' ? 'bg-amber-50/50 border-amber-200' : 'bg-[#e4efe7]/30 border-[#1e6641]/20'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Stethoscope size={15} />
                Decision Support Output (Confidence: {Math.round(triageResult.confidence * 100)}%)
              </div>
              <span className="text-[11px] text-gray-500">{triageResult.provenance}</span>
            </div>

            <div className="text-sm font-semibold text-gray-900 mb-2">
              {triageResult.recommended_next_action}
            </div>

            <ul className="space-y-1.5 text-xs text-gray-700">
              {triageResult.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-gray-400 font-bold">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>

            {triageResult.risk_factors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200/50 text-xs text-gray-600">
                <strong>Demographic Factors:</strong> {triageResult.risk_factors.join('; ')}
              </div>
            )}
          </div>

          {/* Frontline Human Review & Approval */}
          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">ASHA Worker Decision on Triage Recommendation</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Frontline healthcare workers retain full clinical authority. Review and confirm or adjust the urgency.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setHumanDecision('ACCEPT')}
                className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                  humanDecision === 'ACCEPT'
                    ? 'border-[#1e6641] bg-[#e4efe7] text-[#1e6641] ring-2 ring-[#1e6641]/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                ✓ Accept Recommendation
              </button>

              <button
                type="button"
                onClick={() => setHumanDecision('MODIFY')}
                className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                  humanDecision === 'MODIFY'
                    ? 'border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-amber-400/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                ✎ Modify Urgency
              </button>

              <button
                type="button"
                onClick={() => setHumanDecision('REJECT')}
                className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                  humanDecision === 'REJECT'
                    ? 'border-red-400 bg-red-50 text-red-800 ring-2 ring-red-400/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                ✕ Reject / Overrule
              </button>
            </div>

            {humanDecision === 'MODIFY' && (
              <div className="space-y-3 p-3 bg-white rounded-xl border border-amber-200">
                <label className={LABEL}>Adjusted Clinical Urgency</label>
                <div className="flex gap-2">
                  {['ROUTINE', 'PRIORITY', 'URGENT'].map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setModifiedUrgency(u)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        modifiedUrgency === u ? 'bg-amber-600 text-white border-amber-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(humanDecision === 'MODIFY' || humanDecision === 'REJECT') && (
              <div>
                <label className={LABEL}>Clinical Override Rationale *</label>
                <input
                  type="text"
                  value={decisionReason}
                  onChange={e => setDecisionReason(e.target.value)}
                  placeholder="Explain why recommendation was modified or rejected..."
                  className={INPUT}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-50">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(2)}
              className="text-xs flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back
            </Button>
            <Button
              type="button"
              onClick={() => setStep(4)}
              className="bg-[#1e6641] hover:bg-[#165032] text-white flex items-center gap-1.5"
            >
              Continue to Facility Routing <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Facility Routing & Referral ── */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6 shadow-xs">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
            <div className="w-10 h-10 rounded-xl bg-[#e4efe7] text-[#1e6641] flex items-center justify-center">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Facility Routing & Referral</h2>
              <p className="text-xs text-gray-500">Route patient based on hospital operational readiness and clinical capabilities</p>
            </div>
          </div>

          {/* Ranked Facilities from PostgreSQL */}
          <div className="space-y-3">
            <label className={LABEL}>Recommended Healthcare Destinations</label>
            <div className="space-y-2">
              {(rankedFacilities.length > 0 ? rankedFacilities : facilities).map((fac: any) => {
                const facId = fac.facility_id || fac.id;
                const isSelected = selectedFacility === facId;
                const isEligible = fac.eligible ?? fac.isEligible ?? true;
                return (
                  <div
                    key={facId}
                    onClick={() => setSelectedFacility(facId)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#1e6641] bg-[#e4efe7]/30 ring-2 ring-[#1e6641]/20'
                        : isEligible
                        ? 'border-gray-100 bg-white hover:bg-gray-50'
                        : 'border-red-200 bg-red-50/20 opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        {fac.facility_name || fac.name}
                        {fac.level && <span className="text-[10px] text-gray-500 font-normal">(Level {fac.level})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isEligible && (
                          <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                            Ineligible
                          </span>
                        )}
                        {fac.score !== undefined && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isEligible ? 'text-[#1e6641] bg-[#e4efe7]' : 'text-gray-500 bg-gray-100'
                          }`}>
                            {fac.score} / 100
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{fac.type || 'Hospital'}</span>
                      {fac.distance_km != null ? (
                        <span>· ~{fac.distance_km} km away</span>
                      ) : (
                        <span>· Distance not in schema</span>
                      )}
                      {fac.estimated_travel_time_minutes && <span>· ~{fac.estimated_travel_time_minutes} mins</span>}
                    </div>

                    {!isEligible && fac.ineligibilityReasons?.length > 0 && (
                      <div className="text-[11px] text-red-700 mt-2 p-1.5 bg-red-50 rounded border border-red-100">
                        <strong>Ineligible:</strong> {fac.ineligibilityReasons.join('; ')}
                      </div>
                    )}

                    {isEligible && fac.reasons?.length > 0 && (
                      <div className="text-[11px] text-[#1e6641] mt-2 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        {fac.reasons.join(' · ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Referral Notes */}
          <div>
            <label className={LABEL}>Referral Instructions / Clinical Notes for Doctor</label>
            <textarea
              rows={3}
              value={referralNotes}
              onChange={e => setReferralNotes(e.target.value)}
              placeholder="e.g. Patient identified during home visit with elevated blood pressure and severe headache. First dose administered..."
              className={INPUT}
            />
          </div>

          {/* Emergency Ambulance Option */}
          <div className="p-4 rounded-xl border border-red-200 bg-red-50/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                <Ambulance size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900">Request 108 Emergency Ambulance</div>
                <div className="text-[11px] text-gray-500">Alert District Ambulance Dispatch for immediate patient transport</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={needsAmbulance}
              onChange={e => setNeedsAmbulance(e.target.checked)}
              className="w-4 h-4 text-[#1e6641] rounded"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-50">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(3)}
              className="text-xs flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-[#1e6641] hover:bg-[#165032] text-white flex items-center gap-1.5"
            >
              {submitting ? 'Generating Referral...' : <>Submit Encounter & Referral <ArrowRight size={14} /></>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
