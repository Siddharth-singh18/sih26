/**
 * HL7 FHIR Release 4 (R4) Resource Mappings for AyuSync
 * Converts PostgreSQL internal clinical models to standard FHIR representations.
 * Validates structural conformity without inventing synthetic data.
 */

export interface FHIRResource {
  resourceType: string;
  id: string;
  meta?: {
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: any;
}

/**
 * Maps Prisma Patient model to FHIR R4 Patient Resource
 */
export function mapPatientToFHIR(patient: any): FHIRResource {
  const identifiers = [];

  // ABHA Identifier if present
  if (patient.identifiers && Array.isArray(patient.identifiers)) {
    for (const ident of patient.identifiers) {
      if (ident.type === 'ABHA') {
        identifiers.push({
          use: 'official',
          system: 'https://healthid.ndhm.gov.in',
          value: ident.value
        });
      }
    }
  }

  // Internal MRN Identifier
  identifiers.push({
    use: 'secondary',
    system: 'https://ayusync.internal/patients',
    value: patient.id
  });

  const names = [];
  if (patient.name) {
    const parts = patient.name.trim().split(/\s+/);
    names.push({
      use: 'official',
      text: patient.name,
      family: parts.length > 1 ? parts[parts.length - 1] : undefined,
      given: parts.length > 1 ? parts.slice(0, -1) : [parts[0]]
    });
  }

  const telecom = [];
  if (patient.phone) {
    telecom.push({
      system: 'phone',
      value: patient.phone,
      use: 'mobile'
    });
  }

  const addresses = [];
  if (patient.village) {
    addresses.push({
      use: 'home',
      text: patient.village,
      city: patient.village,
      country: 'IND'
    });
  }

  return {
    resourceType: 'Patient',
    id: patient.id,
    meta: {
      lastUpdated: patient.updatedAt ? new Date(patient.updatedAt).toISOString() : new Date().toISOString(),
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient']
    },
    identifier: identifiers,
    active: true,
    name: names,
    telecom,
    gender: (patient.gender || 'unknown').toLowerCase(),
    birthDate: patient.dob ? new Date(patient.dob).toISOString().split('T')[0] : undefined,
    address: addresses
  };
}

/**
 * Maps Prisma Encounter model to FHIR R4 Encounter Resource
 */
export function mapEncounterToFHIR(encounter: any): FHIRResource {
  return {
    resourceType: 'Encounter',
    id: encounter.id,
    meta: {
      lastUpdated: encounter.start ? new Date(encounter.start).toISOString() : new Date().toISOString(),
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Encounter']
    },
    status: encounter.status === 'COMPLETED' ? 'finished' : 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounter.type === 'FIELD_VISIT' ? 'HH' : 'AMB', // Home Health or Ambulatory
      display: encounter.type === 'FIELD_VISIT' ? 'Home Health Visit' : 'Ambulatory Clinic Visit'
    },
    subject: {
      reference: `Patient/${encounter.patientId}`
    },
    serviceProvider: encounter.facilityId ? {
      reference: `Location/${encounter.facilityId}`
    } : undefined,
    period: {
      start: encounter.start ? new Date(encounter.start).toISOString() : undefined,
      end: encounter.end ? new Date(encounter.end).toISOString() : undefined
    }
  };
}

/**
 * Maps Prisma Vital model to FHIR R4 Observation Resource
 */
export function mapVitalToFHIRObservation(vital: any, patientId?: string): FHIRResource {
  const codeMapping: Record<string, { code: string; display: string; system: string }> = {
    BP: { code: '85354-9', display: 'Blood pressure panel', system: 'http://loinc.org' },
    HR: { code: '8867-4', display: 'Heart rate', system: 'http://loinc.org' },
    TEMP: { code: '8310-5', display: 'Body temperature', system: 'http://loinc.org' },
    SPO2: { code: '2708-6', display: 'Oxygen saturation in Arterial blood', system: 'http://loinc.org' }
  };

  const info = codeMapping[vital.type] || {
    code: vital.type,
    display: vital.type,
    system: 'https://ayusync.internal/vitals'
  };

  return {
    resourceType: 'Observation',
    id: vital.id,
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: info.system,
          code: info.code,
          display: info.display
        }
      ],
      text: vital.type
    },
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    encounter: vital.encounterId ? { reference: `Encounter/${vital.encounterId}` } : undefined,
    effectiveDateTime: vital.measuredAt ? new Date(vital.measuredAt).toISOString() : new Date().toISOString(),
    valueQuantity: {
      value: parseFloat(vital.value) || vital.value,
      unit: vital.unit,
      system: 'http://unitsofmeasure.org'
    }
  };
}

/**
 * Maps Prisma Condition model to FHIR R4 Condition Resource
 */
export function mapConditionToFHIR(condition: any): FHIRResource {
  return {
    resourceType: 'Condition',
    id: condition.id,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: condition.status === 'ACTIVE' ? 'active' : 'resolved'
        }
      ]
    },
    code: {
      text: condition.name
    },
    subject: {
      reference: `Patient/${condition.patientId}`
    },
    recordedDate: condition.diagnosedAt ? new Date(condition.diagnosedAt).toISOString() : undefined
  };
}

/**
 * Maps Prisma Prescription model to FHIR R4 MedicationRequest Resource
 */
export function mapPrescriptionToFHIR(prescription: any, patientId?: string): FHIRResource {
  return {
    resourceType: 'MedicationRequest',
    id: prescription.id,
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      text: prescription.medication
    },
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    encounter: prescription.encounterId ? { reference: `Encounter/${prescription.encounterId}` } : undefined,
    dosageInstruction: [
      {
        text: `${prescription.dosage} for ${prescription.duration}${prescription.instructions ? ` (${prescription.instructions})` : ''}`
      }
    ]
  };
}

/**
 * Maps Prisma DiagnosticOrder model to FHIR R4 ServiceRequest Resource
 */
export function mapDiagnosticOrderToFHIR(order: any): FHIRResource {
  return {
    resourceType: 'ServiceRequest',
    id: order.id,
    status: order.status === 'COMPLETED' ? 'completed' : 'active',
    intent: 'order',
    category: [
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '108252007',
            display: 'Laboratory procedure'
          }
        ]
      }
    ],
    code: {
      text: order.testName
    }
  };
}

/**
 * Maps Prisma FollowUp model to FHIR R4 CarePlan Resource
 */
export function mapFollowUpToFHIR(followUp: any): FHIRResource {
  return {
    resourceType: 'CarePlan',
    id: followUp.id,
    status: followUp.status === 'COMPLETED' ? 'completed' : 'active',
    intent: 'plan',
    title: followUp.reason,
    subject: {
      reference: `Patient/${followUp.patientId}`
    },
    period: {
      end: followUp.dueDate ? new Date(followUp.dueDate).toISOString() : undefined
    },
    description: followUp.notes || undefined
  };
}

/**
 * Maps Prisma Referral model to FHIR R4 ServiceRequest Resource
 */
export function mapReferralToFHIR(referral: any): FHIRResource {
  return {
    resourceType: 'ServiceRequest',
    id: referral.id,
    status: referral.status === 'COMPLETED' ? 'completed' : 'active',
    intent: 'order',
    priority: (referral.urgency || 'routine').toLowerCase(),
    code: {
      text: referral.reason
    },
    subject: {
      reference: `Patient/${referral.patientId}`
    },
    locationReference: [
      {
        reference: `Location/${referral.destinationId}`,
        display: 'Destination Facility'
      }
    ]
  };
}

/**
 * Validates standard structural fields of a FHIR resource
 */
export function validateFHIRResource(resource: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors: ['Resource must be an object'] };
  }

  if (!resource.resourceType || typeof resource.resourceType !== 'string') {
    errors.push('Missing or invalid resourceType');
  }

  if (!resource.id || typeof resource.id !== 'string') {
    errors.push('Missing or invalid id');
  }

  // Validate standard FHIR resourceTypes
  const validTypes = [
    'Patient',
    'Encounter',
    'Observation',
    'Condition',
    'MedicationRequest',
    'ServiceRequest',
    'CarePlan',
    'Bundle'
  ];

  if (resource.resourceType && !validTypes.includes(resource.resourceType)) {
    errors.push(`Unsupported FHIR resourceType: ${resource.resourceType}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

