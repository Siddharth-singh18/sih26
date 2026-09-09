/**
 * AYUSYNC CURATED AND VERSIONED HEALTH KNOWLEDGE BASE
 * Guidelines verified from WHO, MoHFW, ICMR, and NCDC.
 */

export interface KnowledgeDocument {
  documentId: string;
  source: 'WHO' | 'MOHFW' | 'ICMR' | 'NHA' | 'NCDC';
  title: string;
  section: string;
  url: string;
  publisher: string;
  publicationDate: string;
  retrievedAt: string;
  version: string;
  language: string;
  topic: string;
  summary: string;
  content: string;
  keywords: string[];
}

export const VERIFIED_HEALTH_DOCUMENTS: KnowledgeDocument[] = [
  {
    documentId: 'DOC-WHO-DENGUE-2024',
    source: 'WHO',
    title: 'Dengue and Severe Dengue Guidelines',
    section: 'Clinical Symptoms and Management',
    url: 'https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue',
    publisher: 'World Health Organization',
    publicationDate: '2024-01-15',
    retrievedAt: '2026-09-01T00:00:00Z',
    version: '2024.1',
    language: 'en',
    topic: 'Vector-borne Diseases / Dengue',
    summary: 'Symptoms include high fever, severe headache, muscle and joint pains, nausea, and rash. Warning signs of severe dengue include severe abdominal pain, persistent vomiting, mucosal bleeding, and lethargy.',
    content: 'Dengue is a viral infection transmitted to humans through the bite of infected mosquitoes. Symptoms typically begin 4-10 days after infection and last for 2-7 days. High fever (40°C/104°F) is accompanied by severe headache, retro-orbital pain, muscle aches, and rash. Warning signs of severe dengue usually appear 3-7 days after symptom onset alongside a drop in temperature: severe abdominal pain, persistent vomiting, fluid accumulation, mucosal bleeding, and platelet drop below 100,000/uL requiring hospitalization.',
    keywords: ['dengue', 'fever', 'platelets', 'headache', 'joint pain', 'severe dengue', 'mosquito', 'bleeding']
  },
  {
    documentId: 'DOC-ICMR-HYPERTENSION-2023',
    source: 'ICMR',
    title: 'ICMR Clinical Management Guidelines for Hypertension',
    section: 'Blood Pressure Classification and Emergency Red Flags',
    url: 'https://www.icmr.gov.in/guidelines/hypertension',
    publisher: 'Indian Council of Medical Research',
    publicationDate: '2023-11-20',
    retrievedAt: '2026-09-01T00:00:00Z',
    version: '2023.2',
    language: 'en',
    topic: 'Non-Communicable Diseases / Hypertension',
    summary: 'Normal blood pressure is <120/80 mmHg. Stage 1 hypertension is 130-139/80-89 mmHg. Stage 2 hypertension is >=140/>=90 mmHg. Systolic > 180 mmHg or Diastolic > 120 mmHg indicates hypertensive crisis.',
    content: 'Hypertension is defined as a persistent systolic BP >= 140 mmHg and/or diastolic BP >= 90 mmHg. In rural settings, lifestyle modification (dietary sodium reduction < 5g/day, physical activity) and first-line antihypertensive therapy (Amlodipine 5mg or Telmisartan 40mg) form the foundation. Hypertensive urgency is BP > 180/120 mmHg without end-organ damage. Hypertensive emergency includes acute organ damage (chest pain, dyspnea, focal neurological deficits) and requires immediate parenteral therapy and tertiary facility referral.',
    keywords: ['hypertension', 'blood pressure', 'bp', 'systolic', 'diastolic', 'high bp', 'amlodipine', 'stroke']
  },
  {
    documentId: 'DOC-ICMR-DIABETES-2023',
    source: 'ICMR',
    title: 'ICMR Guidelines for Management of Type 2 Diabetes in India',
    section: 'Diagnostic Criteria, Glycemic Targets, and Complication Screening',
    url: 'https://www.icmr.gov.in/guidelines/diabetes_type2',
    publisher: 'Indian Council of Medical Research',
    publicationDate: '2023-08-10',
    retrievedAt: '2026-09-01T00:00:00Z',
    version: '2023.1',
    language: 'en',
    topic: 'Endocrine / Type 2 Diabetes',
    summary: 'Fasting blood glucose >= 126 mg/dL or postprandial >= 200 mg/dL or HbA1c >= 6.5% confirms diabetes. Target HbA1c is < 7.0% for most adults.',
    content: 'Type 2 Diabetes Mellitus requires comprehensive glycemic and cardiovascular risk management. Diagnostic criteria: Fasting Blood Glucose (FBG) >= 126 mg/dL (7.0 mmol/L), 2-hour Postprandial Glucose >= 200 mg/dL (11.1 mmol/L), or HbA1c >= 6.5%. Lifestyle interventions include high-fiber complex carbohydrates and moderate aerobic exercise 150 min/week. First-line pharmacotherapy is Metformin 500mg-1000mg twice daily with meals unless contraindicated by severe renal impairment. Annual screening for diabetic retinopathy, nephropathy, and diabetic foot ulceration is mandatory.',
    keywords: ['diabetes', 'sugar', 'blood sugar', 'glucose', 'metformin', 'hba1c', 'fasting', 'postprandial']
  },
  {
    documentId: 'DOC-MOHFW-ANC-2024',
    source: 'MOHFW',
    title: 'Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA) & Antenatal Care Protocols',
    section: 'High-Risk Pregnancy Identification & Schedule',
    url: 'https://pmsma.nhp.gov.in/about-pmsma/guidelines/',
    publisher: 'Ministry of Health and Family Welfare, Govt of India',
    publicationDate: '2024-02-01',
    retrievedAt: '2026-09-01T00:00:00Z',
    version: '2024.1',
    language: 'en',
    topic: 'Maternal Health / Antenatal Care',
    summary: 'Minimum four mandatory ANC check-ups. High-risk indicators: severe anemia (Hb < 7 g/dL), pre-eclampsia (BP >= 140/90 with proteinuria), gestational diabetes, multiple gestation, or prior cesarean.',
    content: 'Every pregnant woman must receive quality antenatal care with a minimum of 4 visits: Visit 1 within first trimester (<12 weeks), Visit 2 between 14-26 weeks, Visit 3 between 28-34 weeks, and Visit 4 between 36 weeks and delivery. Routine testing includes hemoglobin, urine albumin/sugar, blood grouping, and ultrasound. High-risk pregnancies (HRP) must be red-flagged for institutional delivery at a First Referral Unit (FRU/CHC) with functional obstetrician and blood bank services.',
    keywords: ['pregnancy', 'maternal', 'anc', 'antenatal', 'baby', 'delivery', 'pmsma', 'anemia', 'high risk pregnancy']
  },
  {
    documentId: 'DOC-WHO-RESPIRATORY-2023',
    source: 'WHO',
    title: 'Clinical Care for Severe Acute Respiratory Infection (SARI) and Hypoxemia',
    section: 'Pulse Oximetry Thresholds and Oxygen Therapy',
    url: 'https://www.who.int/publications/i/item/clinical-care-for-severe-acute-respiratory-infection',
    publisher: 'World Health Organization',
    publicationDate: '2023-05-15',
    retrievedAt: '2026-09-01T00:00:00Z',
    version: '2023.1',
    language: 'en',
    topic: 'Pulmonology / Acute Respiratory Illness',
    summary: 'Normal pulse oximeter SpO2 reading is 95-100% at sea level. SpO2 between 90-94% requires clinical observation. SpO2 < 90% is a critical red flag indicating severe hypoxemia requiring immediate emergency supplemental oxygen.',
    content: 'Pulse oximetry is an essential non-invasive tool to detect hypoxemia. In adults and children, SpO2 < 90% in room air indicates respiratory failure and warrants immediate oxygen therapy (target SpO2 >= 94%, or >= 88-92% in patients with chronic hypercapnic respiratory failure). Respiratory rate > 30 breaths/minute or severe intercostal retractions indicate respiratory distress requiring immediate escalation to an ICU/Oxygen-supported facility.',
    keywords: ['spo2', 'oxygen', 'respiratory', 'breathing', 'lungs', 'pulse oximeter', 'hypoxemia', 'asthma', 'pneumonia']
  },
  {
    documentId: 'DOC-MOHFW-NTEP-2023',
    source: 'MOHFW',
    title: 'National Tuberculosis Elimination Programme (NTEP) Technical & Operational Guidelines',
    section: 'Presumptive TB Symptoms, Diagnostic Algorithm, and DOTS',
    url: 'https://tbcindia.gov.in/index1.php?lang=1&level=1&sublinkid=4156&lid=2798',
    publisher: 'Central TB Division, MoHFW',
    publicationDate: '2023-03-24',
    retrievedAt: '2026-09-01T00:00:00Z',
    version: '2023.2',
    language: 'en',
    topic: 'Infectious Diseases / Tuberculosis',
    summary: 'Cough lasting >= 2 weeks, fever >= 2 weeks, unexplained weight loss, night sweats, or hemoptysis qualify as presumptive pulmonary TB requiring NAAT/Truenat/GeneXpert testing.',
    content: 'Tuberculosis is an infectious disease caused by Mycobacterium tuberculosis. Under NTEP India, any individual with cough for 2 weeks or more must undergo rapid molecular testing (CBNAAT/Truenat) and chest X-ray. Treatment consists of fixed-dose combination anti-TB drugs administered via Directly Observed Therapy (DOTS). Nikshay portal enrollment provides nutritional support (Nikshay Poshan Yojana) of Rs 500/month during treatment.',
    keywords: ['tuberculosis', 'tb', 'cough', 'nikshay', 'dots', 'weight loss', 'night sweats', 'hemoptysis']
  }
];

