import { Request, Response } from 'express';
import { prisma } from '../../index';
import {
  mapPatientToFHIR,
  mapEncounterToFHIR,
  mapVitalToFHIRObservation,
  mapPrescriptionToFHIR,
  validateFHIRResource
} from './fhir.mapper';
import { interopAdapter } from './abdm.adapter';
import { AbhaAdapter } from './abha.adapter';
import { recordAuditLog } from '../audit/audit.service';

/**
 * System Interoperability Status Endpoint
 * Honestly discloses ABDM, ABHA, and FHIR readiness.
 */
export const getInteropStatus = async (_req: Request, res: Response) => {
  res.json({
    system: 'AyuSync Interoperability Engine',
    version: '1.0.0',
    fhirStandard: 'HL7 FHIR Release 4 (R4)',
    adapters: {
      abdmGateway: interopAdapter.getStatus(),
      abhaRegistry: AbhaAdapter.getStatus(),
      fhirMapper: {
        status: 'VERIFIED',
        supportedResources: [
          'Patient',
          'Encounter',
          'Observation',
          'Condition',
          'MedicationRequest',
          'ServiceRequest',
          'CarePlan'
        ]
      }
    },
    sourceOfTruth: 'PostgreSQL',
    timestamp: new Date().toISOString()
  });
};

/**
 * FHIR R4 Patient Export
 * Retrieves authentic PostgreSQL patient and returns standard FHIR resource.
 */
export const getFHIRPatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        identifiers: true
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const fhirPatient = mapPatientToFHIR(patient);
    const validation = validateFHIRResource(fhirPatient);

    res.json({
      resource: fhirPatient,
      validation
    });
  } catch (error: any) {
    console.error('Error generating FHIR Patient:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * FHIR R4 Clinical Encounter Bundle Export
 * Bundles Encounter, Vitals (Observations), and Prescriptions.
 */
export const getFHIREncounterBundle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const encounter = await prisma.encounter.findUnique({
      where: { id },
      include: {
        vitals: true,
        prescriptions: true,
        clinicalObs: true
      }
    });

    if (!encounter) {
      return res.status(404).json({ error: 'Encounter not found' });
    }

    const fhirEncounter = mapEncounterToFHIR(encounter);
    const observations = (encounter.vitals || []).map(v => mapVitalToFHIRObservation(v, encounter.patientId));
    const prescriptions = (encounter.prescriptions || []).map(p => mapPrescriptionToFHIR(p, encounter.patientId));

    const bundle = {
      resourceType: 'Bundle',
      id: `bundle-${encounter.id}`,
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: [
        { resource: fhirEncounter },
        ...observations.map(o => ({ resource: o })),
        ...prescriptions.map(p => ({ resource: p }))
      ]
    };

    res.json(bundle);
  } catch (error: any) {
    console.error('Error generating FHIR Encounter Bundle:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * ABDM Gateway Sync Action
 * Audits attempt and returns honest status (BLOCKED_EXTERNAL if credentials absent).
 */
export const syncABDMGateway = async (req: Request, res: Response) => {
  try {
    const { resourceType, resourceId, payload } = req.body;
    const user = (req as any).user;

    const result = await interopAdapter.syncToGateway(payload || { resourceType, id: resourceId });

    // Record audit trail of external sync attempt
    await recordAuditLog({
      userId: user?.id || null,
      action: 'ABDM_GATEWAY_SYNC_ATTEMPT',
      resource: resourceType || 'CLINICAL_RESOURCE',
      resourceId: resourceId || null
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in ABDM sync:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

