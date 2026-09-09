/**
 * AYUSYNC AUTHORITATIVE HEALTH KNOWLEDGE SOURCE REGISTRY
 * Strict curation policy: Only officially verified public-health bodies are permitted.
 * Zero unvetted blogs, forums, or third-party web content.
 */

export interface HealthKnowledgeSource {
  sourceId: string;
  name: string;
  publisher: string;
  authorityLevel: 'GLOBAL_PUBLIC_HEALTH' | 'NATIONAL_GOVERNMENT' | 'NATIONAL_RESEARCH' | 'APEX_CLINICAL';
  allowedForMedicalAnswer: boolean;
  officialDomain: string;
  description: string;
}

export const AUTHORITATIVE_SOURCES: Record<string, HealthKnowledgeSource> = {
  'WHO': {
    sourceId: 'WHO',
    name: 'World Health Organization',
    publisher: 'World Health Organization',
    authorityLevel: 'GLOBAL_PUBLIC_HEALTH',
    allowedForMedicalAnswer: true,
    officialDomain: 'https://www.who.int',
    description: 'United Nations specialized agency for international public health.'
  },
  'MOHFW': {
    sourceId: 'MOHFW',
    name: 'Ministry of Health and Family Welfare, Govt of India',
    publisher: 'MoHFW, Government of India',
    authorityLevel: 'NATIONAL_GOVERNMENT',
    allowedForMedicalAnswer: true,
    officialDomain: 'https://main.mohfw.gov.in',
    description: 'Apex ministry governing health policy, national guidelines, and primary healthcare in India.'
  },
  'ICMR': {
    sourceId: 'ICMR',
    name: 'Indian Council of Medical Research',
    publisher: 'Indian Council of Medical Research',
    authorityLevel: 'NATIONAL_RESEARCH',
    allowedForMedicalAnswer: true,
    officialDomain: 'https://www.icmr.gov.in',
    description: 'Apex body in India for the formulation, coordination and promotion of biomedical research.'
  },
  'NHA': {
    sourceId: 'NHA',
    name: 'National Health Authority (ABDM / PM-JAY)',
    publisher: 'National Health Authority',
    authorityLevel: 'NATIONAL_GOVERNMENT',
    allowedForMedicalAnswer: true,
    officialDomain: 'https://nha.gov.in',
    description: 'Autonomous agency implementing Ayushman Bharat Pradhan Mantri Jan Arogya Yojana and Digital Mission.'
  },
  'NCDC': {
    sourceId: 'NCDC',
    name: 'National Centre for Disease Control',
    publisher: 'Directorate General of Health Services, MoHFW',
    authorityLevel: 'NATIONAL_GOVERNMENT',
    allowedForMedicalAnswer: true,
    officialDomain: 'https://ncdc.mohfw.gov.in',
    description: 'National surveillance agency for communicable disease surveillance and outbreak response.'
  }
};

export function isSourceAllowed(sourceId: string): boolean {
  const source = AUTHORITATIVE_SOURCES[sourceId.toUpperCase()];
  return Boolean(source && source.allowedForMedicalAnswer);
}

