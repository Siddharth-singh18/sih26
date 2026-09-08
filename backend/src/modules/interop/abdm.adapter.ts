import { Patient, Encounter, Appointment } from '@prisma/client';

export class ABDMAdapter {
  private sandboxMode = true;

  constructor(sandboxMode = true) {
    this.sandboxMode = sandboxMode;
  }

  // FHIR Mapping: Patient -> FHIR Patient
  public mapPatient(patient: Patient) {
    return {
      resourceType: "Patient",
      id: patient.id,
      identifier: [
        {
          use: "official",
          system: "https://ndhm.gov.in/abha",
          value: "UNVERIFIED-SANDBOX-ABHA"
        }
      ],
      name: [
        {
          use: "official",
          text: patient.name,
          family: patient.name.split(' ').pop(),
          given: patient.name.split(' ')
        }
      ],
      gender: patient.gender.toLowerCase(),
      birthDate: patient.dob ? patient.dob.toISOString().split('T')[0] : '1970-01-01',
      telecom: patient.phone ? [
        {
          system: "phone",
          value: patient.phone,
          use: "mobile"
        }
      ] : []
    };
  }

  // Pseudo FHIR bundle transmission Sandbox
  public async syncToGateway(resource: any) {
    if (this.sandboxMode) {
      console.log(`[ABDM SANDBOX] Emulating successful gateway sync for resource ${resource.resourceType}`);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        status: "SUCCESS",
        correlationId: `SANDBOX-CORR-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } else {
      // Live integration would go here
      throw new Error("UNVERIFIED — EXTERNAL CREDENTIAL REQUIRED");
    }
  }
}

export const interopAdapter = new ABDMAdapter(true);
