import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  getInteropStatus,
  getFHIRPatient,
  getFHIREncounterBundle,
  syncABDMGateway
} from './interop.controller';

const router = Router();

// Interoperability status (authenticated)
router.get('/status', authenticate, getInteropStatus);

// FHIR R4 Patient Resource
router.get('/fhir/patient/:id', authenticate, getFHIRPatient);

// FHIR R4 Encounter Bundle
router.get('/fhir/encounter/:id', authenticate, getFHIREncounterBundle);

// ABDM Gateway Sync Attempt
router.post('/abdm/sync', authenticate, syncABDMGateway);

export default router;

