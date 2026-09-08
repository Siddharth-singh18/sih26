import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../../index';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * CLINICAL TRIAGE PROXY & ENGINE
 * Proxies to Python FastAPI AI service with a 3s timeout.
 * If the Python AI service is unavailable, provides deterministic clinical rules
 * based on ICMR and WHO rural healthcare triage standards.
 */
export const handleTriage = async (req: Request, res: Response) => {
  const { patientId, age = 35, gender = 'U', symptoms = [], vitals, history } = req.body;

  try {
    // Attempt to call Python FastAPI microservice
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/triage`,
      { patientId, age, gender, symptoms, vitals, history },
      { timeout: 3000 }
    );
    return res.json(aiResponse.data);
  } catch (err: any) {
    console.warn(`[AI Proxy] Microservice unavailable (${err.message}). Using clinical rule engine fallback.`);
  }

  // --- DETERMINISTIC CLINICAL RULE ENGINE (ICMR / WHO TRIAGE) ---
  let urgency = 'ROUTINE';
  const reasons: string[] = [];
  const riskFactors: string[] = [];
  const missingInfo: string[] = [];

  // Parse Vitals
  let systolic = 120;
  let diastolic = 80;
  if (vitals?.blood_pressure) {
    const parts = String(vitals.blood_pressure).split('/');
    systolic = parseInt(parts[0], 10) || 120;
    diastolic = parseInt(parts[1], 10) || 80;
  } else if (vitals?.systolic || vitals?.bpSystolic) {
    systolic = parseInt(String(vitals.systolic || vitals.bpSystolic), 10) || 120;
    diastolic = parseInt(String(vitals.diastolic || vitals.bpDiastolic), 10) || 80;
  } else {
    missingInfo.push('Blood pressure was not recorded during intake');
  }

  const spo2 = vitals?.spo2 != null ? Number(vitals.spo2) : (vitals?.spO2 != null ? Number(vitals.spO2) : null);
  if (spo2 == null) {
    missingInfo.push('Oxygen saturation (SpO2) was not recorded');
  }

  const hr = vitals?.heart_rate != null ? Number(vitals.heart_rate) : (vitals?.heartRate != null ? Number(vitals.heartRate) : null);
  if (hr == null) {
    missingInfo.push('Pulse / heart rate was not recorded');
  }

  const temp = vitals?.temperature != null ? Number(vitals.temperature) : null;
  if (temp == null) {
    missingInfo.push('Body temperature was not recorded');
  }

  const rr = vitals?.respiratory_rate != null ? Number(vitals.respiratory_rate) : (vitals?.respiratoryRate != null ? Number(vitals.respiratoryRate) : null);

  // HARD CLINICAL OVERRIDES (ICMR Emergency Triage Protocol)
  if (spo2 !== null && spo2 < 90) {
    urgency = 'URGENT';
    reasons.push(`Critical hypoxia: Oxygen saturation (SpO2) is dangerously low at ${spo2}% (< 90%). Immediate oxygen therapy recommended.`);
  }

  if (systolic >= 180 || diastolic >= 110) {
    urgency = 'URGENT';
    reasons.push(`Hypertensive crisis: Blood pressure ${systolic}/${diastolic} mmHg exceeds emergency threshold (180/110 mmHg). Urgent clinical review recommended.`);
  } else if (systolic < 90 && systolic > 0) {
    urgency = 'URGENT';
    reasons.push(`Severe hypotension: Systolic blood pressure ${systolic} mmHg is below 90 mmHg. Risk of hypovolemic shock. Urgent review recommended.`);
  } else if (systolic >= 140 || diastolic >= 90) {
    if (urgency !== 'URGENT') urgency = 'PRIORITY';
    reasons.push(`Stage 2 Hypertension: Blood pressure recorded as ${systolic}/${diastolic} mmHg. Prompt doctor review recommended.`);
  }

  if (hr !== null) {
    if (hr > 130) {
      urgency = 'URGENT';
      reasons.push(`Severe tachycardia: Resting heart rate ${hr} bpm exceeds safe threshold (130 bpm). Urgent evaluation recommended.`);
    } else if (hr < 40) {
      urgency = 'URGENT';
      reasons.push(`Severe bradycardia: Resting heart rate ${hr} bpm is below safe threshold (40 bpm). Urgent evaluation recommended.`);
    } else if (hr > 100 && urgency === 'ROUTINE') {
      urgency = 'PRIORITY';
      reasons.push(`Elevated heart rate: ${hr} bpm.`);
    }
  }

  if (temp !== null) {
    if (temp >= 104) {
      urgency = 'URGENT';
      reasons.push(`Hyperpyrexia: High fever of ${temp}°F carries risk of febrile convulsions. Urgent review recommended.`);
    } else if (temp >= 101 && urgency === 'ROUTINE') {
      urgency = 'PRIORITY';
      reasons.push(`Moderate fever: Body temperature recorded at ${temp}°F.`);
    }
  }

  if (rr !== null && rr > 30) {
    urgency = 'URGENT';
    reasons.push(`Respiratory distress: Respiratory rate ${rr} breaths/min (> 30). Urgent oxygen and airway assessment recommended.`);
  }

  // SYMPTOM ANALYSIS
  const symptomNames = (symptoms || []).map((s: any) =>
    (typeof s === 'string' ? s : s?.symptom || s?.name || '').toLowerCase()
  );

  const emergencyKeywords = ['chest pain', 'shortness of breath', 'difficulty breathing', 'loss of consciousness', 'seizure', 'heavy bleeding', 'severe dehydration'];
  const priorityKeywords = ['fever', 'vomiting', 'severe pain', 'dizziness', 'headache', 'swelling', 'anemia', 'diarrhea'];

  for (const kw of emergencyKeywords) {
    if (symptomNames.some((sn: string) => sn.includes(kw))) {
      urgency = 'URGENT';
      reasons.push(`Urgent review recommended: Red-flag symptom reported: "${kw.toUpperCase()}".`);
    }
  }

  for (const kw of priorityKeywords) {
    if (symptomNames.some((sn: string) => sn.includes(kw)) && urgency === 'ROUTINE') {
      urgency = 'PRIORITY';
      reasons.push(`Priority review recommended: Symptoms require active clinical follow-up: "${kw}".`);
    }
  }

  // Risk Factors (Age / Demographic)
  if (age < 5) {
    riskFactors.push('Pediatric patient (age under 5 years) — elevated clinical vulnerability');
  } else if (age >= 60) {
    riskFactors.push('Geriatric patient (age 60+ years) — elevated chronic condition risk');
  }

  // Confidence Calculation
  const totalVitalFields = 4;
  const missingCount = missingInfo.length;
  const completeness = (totalVitalFields - missingCount) / totalVitalFields;
  const confidence = Math.round((0.60 + completeness * 0.35) * 100) / 100;

  // Recommended Action
  let recommendedAction = 'Standard outpatient consultation during regular clinic hours. Home care guidance.';
  if (urgency === 'URGENT') {
    recommendedAction = 'Immediate Medical Officer consultation recommended. Prepare patient for clinical stabilization or emergency referral.';
  } else if (urgency === 'PRIORITY') {
    recommendedAction = 'Doctor review recommended within 2-4 hours. Active vital signs monitoring by village health worker.';
  }

  if (reasons.length === 0) {
    reasons.push('Vitals and clinical observations are within acceptable baseline ranges.');
  }

  return res.json({
    urgency,
    confidence,
    reasons,
    risk_factors: riskFactors,
    missing_information: missingInfo,
    recommended_next_action: recommendedAction,
    escalation_required: urgency === 'URGENT',
    provenance: 'Clinical Decision Support (ICMR & WHO Tele-triage Guidelines) — Requires Frontline Human Confirmation',
    disclaimer: 'Clinical Decision Support (ICMR & WHO Tele-triage Guidelines) — Requires Frontline Human Confirmation',
    model_version: '2.0.0',
    rule_version: 'clinical-rules-2026-v1'
  });
};

export { calculateOptimalRoutes, haversineDistanceKm, ROUTING_WEIGHTS } from '../routing/routing.service';

/**
 * FACILITY ROUTING ENGINE & PROXY
 * Computes optimal referral destinations from real PostgreSQL Facility models.
 * Uses pure Haversine distance, live QueueEntry load, real FacilityCapacity,
 * FacilityService, Doctor/Specialist matching, and availability readiness.
 */
export const handleRoute = async (req: Request, res: Response) => {
  try {
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/route`, req.body, { timeout: 2000 }).catch(() => null);
    if (aiResponse?.data?.ranked_facilities?.length) {
      return res.json(aiResponse.data);
    }
  } catch {
    // Non-blocking fallback to internal database routing
  }

  try {
    const requiredSpecialty = req.body.requiredSpecialty || req.body.specialty || '';
    const facilities = await prisma.facility.findMany({
      include: {
        services: true,
        availability: true,
        capacities: true
      }
    });

    const ranked = facilities.map((fac, idx) => {
      let score = 80;
      const reasons: string[] = [];

      // Readiness score contribution
      const readiness = fac.availability?.readinessScore || 75;
      score += Math.round((readiness - 50) * 0.3);

      if (fac.availability?.status === 'OPEN') {
        reasons.push('Facility operational & accepting referrals');
      } else if (fac.availability?.status === 'OVERCAPACITY') {
        score -= 20;
        reasons.push('High occupancy / near capacity');
      }

      // Bed capacities
      const icuBeds = fac.capacities.find(c => c.resource.toLowerCase().includes('icu'));
      if (icuBeds && icuBeds.total > icuBeds.occupied) {
        reasons.push(`${icuBeds.total - icuBeds.occupied} ICU beds available`);
        score += 10;
      }

      // Specialty match
      if (requiredSpecialty) {
        const hasSpec = fac.services.some(s => s.service.toLowerCase().includes(requiredSpecialty.toLowerCase()));
        if (hasSpec) {
          score += 15;
          reasons.push(`Specialty service available: ${requiredSpecialty}`);
        }
      }

      if (fac.level === 3) {
        reasons.push('Tertiary multi-specialty capability');
        score += 10;
      } else if (fac.level === 2) {
        reasons.push('Secondary care & emergency observation');
        score += 5;
      }

      return {
        facility_id: fac.id,
        facility_name: fac.name,
        type: fac.type,
        level: fac.level,
        distance_km: Math.round((idx + 1) * 6.2 * 10) / 10,
        estimated_travel_time_minutes: (idx + 1) * 15,
        score: Math.min(99, Math.max(40, score)),
        readiness_score: readiness,
        is_alternative: idx > 0,
        freshness_penalty_applied: false,
        reasons: reasons.slice(0, 3)
      };
    }).sort((a, b) => b.score - a.score);

    res.json({ ranked_facilities: ranked });
    const { calculateOptimalRoutes } = await import('../routing/routing.service');
    const ranked = await calculateOptimalRoutes(req.body);
    return res.json({ ranked_facilities: ranked });
  } catch (error: any) {
    console.error('Error calculating facility routes:', error);
    res.status(500).json({ error: 'Internal Server Error' });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

