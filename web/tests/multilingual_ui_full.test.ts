import { SUPPORTED_LANGUAGES, getLanguagesByCapability, isLanguageSupported, type UICapability } from '../src/i18n/languages.ts';
import { GLOBAL_DICTIONARY, translateWithFallback, interpolate } from '../src/i18n/dictionaries.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

let assertionCount = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  assertionCount++;
}

console.log('🧪 Starting AyuSync Comprehensive Multilingual UI & Localization Test Suite...\n');

// ============================================================================
// SUITE 1: 23-LANGUAGE REGISTRY & CAPABILITY INTEGRITY
// ============================================================================
console.log('--- Suite 1: 23 Constitutional Languages & Capability Model ---');

testAssert(SUPPORTED_LANGUAGES.length === 23, `Must have exactly 23 languages, got ${SUPPORTED_LANGUAGES.length}`);

const fullUILangs = getLanguagesByCapability('FULL_UI');
const partialUILangs = getLanguagesByCapability('PARTIAL_UI');
const textOnlyLangs = getLanguagesByCapability('TEXT_ONLY');
const fallbackLangs = getLanguagesByCapability('FALLBACK');

testAssert(fullUILangs.length === 6, `FULL_UI must have 6 languages, got ${fullUILangs.length}`);
testAssert(partialUILangs.length === 5, `PARTIAL_UI must have 5 languages, got ${partialUILangs.length}`);
testAssert(textOnlyLangs.length === 11, `TEXT_ONLY must have 11 languages, got ${textOnlyLangs.length}`);
testAssert(fallbackLangs.length === 1, `FALLBACK must have 1 language, got ${fallbackLangs.length}`);
testAssert(
  fullUILangs.length + partialUILangs.length + textOnlyLangs.length + fallbackLangs.length === 23,
  'Sum of capability buckets must be 23'
);

// Check specific language codes in FULL_UI
const fullUICodes = ['en-IN', 'hi-IN', 'bn-IN', 'mr-IN', 'ta-IN', 'te-IN'];
for (const code of fullUICodes) {
  testAssert(isLanguageSupported(code), `Language ${code} must be supported`);
  const found = fullUILangs.find((l) => l.code === code);
  testAssert(!!found, `${code} must be in FULL_UI list`);
  testAssert(found?.uiCapability === 'FULL_UI', `${code} capability must be FULL_UI`);
}

// Check PARTIAL_UI codes
const partialCodes = ['gu-IN', 'kn-IN', 'ml-IN', 'pa-IN', 'od-IN'];
for (const code of partialCodes) {
  testAssert(isLanguageSupported(code), `Language ${code} must be supported`);
  const found = partialUILangs.find((l) => l.code === code);
  testAssert(!!found, `${code} must be in PARTIAL_UI list`);
  testAssert(found?.uiCapability === 'PARTIAL_UI', `${code} capability must be PARTIAL_UI`);
}

// Check TEXT_ONLY codes
const textOnlyCodes = ['as-IN', 'brx-IN', 'doi-IN', 'kok-IN', 'mai-IN', 'mni-IN', 'ne-IN', 'sa-IN', 'sat-IN', 'sd-IN', 'ur-IN'];
for (const code of textOnlyCodes) {
  testAssert(isLanguageSupported(code), `Language ${code} must be supported`);
  const found = textOnlyLangs.find((l) => l.code === code);
  testAssert(!!found, `${code} must be in TEXT_ONLY list`);
  testAssert(found?.uiCapability === 'TEXT_ONLY', `${code} capability must be TEXT_ONLY`);
}

// Check FALLBACK code (Kashmiri)
testAssert(isLanguageSupported('ks-IN'), 'ks-IN must be supported');
testAssert(fallbackLangs[0].code === 'ks-IN', 'ks-IN must be in FALLBACK list');
testAssert(fallbackLangs[0].uiCapability === 'FALLBACK', 'ks-IN capability must be FALLBACK');

console.log(`  ✓ 23 languages verified (${assertionCount} assertions passed)`);

// ============================================================================
// SUITE 2: ZERO BILINGUAL DUPLICATES & STRICT STRING REPLACEMENT
// ============================================================================
console.log('\n--- Suite 2: Zero Bilingual Duplicates & Clean Replacement ---');

// The forbidden regex: checks if an English phrase/word is appended or concatenated
// directly before or after Indic scripts (Devanagari, Bengali, Tamil, Telugu, Gujarati, Gurmukhi, Kannada, Malayalam, Oriya).
// E.g., "CARE ACTIONS & FOLLOW-UPSउपचार कार्य" or "ALL APPOINTMENTS (106)सभी अपॉइंटमेंट (106)"
const bilingualConcatRegex = /([A-Za-z]{3,}\s*[\u0900-\u0DFF])|([\u0900-\u0DFF]\s*[A-Za-z]{3,})/;

const testKeys = [
  'appointment.today_title',
  'queue.live_title',
  'queue.wait_position',
  'queue.est_wait',
  'care.actions_title',
  'care.all_clear',
  'care.recent_milestones',
  'care.complete_record',
  'vitals.title',
  'meds.title',
  'diagnostics.title',
  'referral.active_title',
  'helpline.title',
  'modal.appointments_title',
  'modal.prescriptions_title',
  'modal.diagnostics_title',
  'modal.referral_title',
  'modal.booking_title'
];

const majorLangs = ['hi-IN', 'mr-IN', 'ta-IN', 'te-IN', 'bn-IN'];

for (const key of testKeys) {
  for (const lang of majorLangs) {
    const res = translateWithFallback(key, lang);
    testAssert(!res.isFallback, `Key '${key}' should NOT fall back for major language ${lang}`);
    testAssert(res.text.length > 0, `Key '${key}' must not have empty translation in ${lang}`);
    testAssert(
      !bilingualConcatRegex.test(res.text),
      `Key '${key}' in ${lang} must NOT contain bilingual concatenated text: "${res.text}"`
    );
  }
}

console.log(`  ✓ Zero bilingual concatenation verified across critical keys (${assertionCount} total assertions)`);

// ============================================================================
// SUITE 3: DYNAMIC INTERPOLATION AND COUNT REPLACEMENTS
// ============================================================================
console.log('\n--- Suite 3: Dynamic Parameter Interpolation ---');

// 1. All Appointments count
const hiAppts = translateWithFallback('patient.all_appointments', 'hi-IN', { count: 106 });
testAssert(hiAppts.text === 'सभी अपॉइंटमेंट (106)', `Hindi all appointments must be 'सभी अपॉइंटमेंट (106)', got '${hiAppts.text}'`);
testAssert(!hiAppts.text.includes('All Appointments'), 'Hindi all appointments must not contain English text');

const mrAppts = translateWithFallback('patient.all_appointments', 'mr-IN', { count: 42 });
testAssert(mrAppts.text === 'सर्व भेटी (42)', `Marathi all appointments must be 'सर्व भेटी (42)', got '${mrAppts.text}'`);

const taAppts = translateWithFallback('patient.all_appointments', 'ta-IN', { count: 15 });
testAssert(taAppts.text === 'அனைத்து சந்திப்புகள் (15)', `Tamil all appointments must be 'அனைத்து சந்திப்புகள் (15)', got '${taAppts.text}'`);

const teAppts = translateWithFallback('patient.all_appointments', 'te-IN', { count: 8 });
testAssert(teAppts.text === 'అన్ని అపాయింట్‌మెంట్లు (8)', `Telugu all appointments must be 'అన్ని అపాయింట్‌మెంట్లు (8)', got '${teAppts.text}'`);

const bnAppts = translateWithFallback('patient.all_appointments', 'bn-IN', { count: 20 });
testAssert(bnAppts.text === 'সব অ্যাপয়েন্টমেন্ট (20)', `Bengali all appointments must be 'সব অ্যাপয়েন্টমেন্ট (20)', got '${bnAppts.text}'`);

// 2. Pending counts
const hiPending = translateWithFallback('care.pending_count', 'hi-IN', { count: 3 });
testAssert(hiPending.text === '3 लंबित', `Hindi pending count must be '3 लंबित', got '${hiPending.text}'`);

const mrPending = translateWithFallback('care.pending_count', 'mr-IN', { count: 5 });
testAssert(mrPending.text === '5 प्रलंबित', `Marathi pending count must be '5 प्रलंबित', got '${mrPending.text}'`);

const taPending = translateWithFallback('care.pending_count', 'ta-IN', { count: 2 });
testAssert(taPending.text === '2 நிலுவையில்', `Tamil pending count must be '2 நிலுவையில்', got '${taPending.text}'`);

// 3. Active Meds count
const hiMeds = translateWithFallback('meds.active_count', 'hi-IN', { count: 4 });
testAssert(hiMeds.text === '4 सक्रिय', `Hindi active meds must be '4 सक्रिय', got '${hiMeds.text}'`);

// 4. Modal tabs
const hiTabUpcoming = translateWithFallback('tab.upcoming_active', 'hi-IN', { count: 2 });
testAssert(hiTabUpcoming.text === 'आगामी व सक्रिय (2)', `Hindi upcoming tab must be 'आगामी व सक्रिय (2)', got '${hiTabUpcoming.text}'`);

const hiTabPast = translateWithFallback('tab.past_consultations', 'hi-IN', { count: 18 });
testAssert(hiTabPast.text === 'पूर्व चिकित्सीय परामर्श (18)', `Hindi past tab must be 'पूर्व चिकित्सीय परामर्श (18)', got '${hiTabPast.text}'`);

console.log(`  ✓ Dynamic interpolation verified (${assertionCount} total assertions)`);

// ============================================================================
// SUITE 4: CANONICAL STATUS BADGE TRANSLATION & IMMUTABILITY
// ============================================================================
console.log('\n--- Suite 4: Canonical Status Badge Localization ---');

const canonicalStatuses = [
  { key: 'status.booked', expectedHi: 'आरक्षित', expectedMr: 'नोंदणीकृत', expectedTa: 'பதிவு செய்யப்பட்டது' },
  { key: 'status.waiting', expectedHi: 'प्रतीक्षारत', expectedMr: 'प्रतीक्षेत', expectedTa: 'காத்திருக்கிறது' },
  { key: 'status.in_consultation', expectedHi: 'परामर्श में', expectedMr: 'सल्लामसलत सुरू', expectedTa: 'ஆலோசனையில்' },
  { key: 'status.completed', expectedHi: 'पूर्ण', expectedMr: 'पूर्ण झाले', expectedTa: 'முடிந்தது' },
  { key: 'status.cancelled', expectedHi: 'रद्द', expectedMr: 'रद्द केले', expectedTa: 'ரத்து செய்யப்பட்டது' },
  { key: 'status.emergency', expectedHi: 'आपातकालीन', expectedMr: 'आपत्कालीन', expectedTa: 'அவசரகால சிகிச்சை' },
  { key: 'status.urgent', expectedHi: 'अति आवश्यक देखभाल', expectedMr: 'तातडीची काळजी आवश्यक', expectedTa: 'அவசர சிகிச்சை தேவை' },
  { key: 'status.pending', expectedHi: 'लंबित', expectedMr: 'प्रलंबित', expectedTa: 'நிலுவையில்' },
  { key: 'status.overdue', expectedHi: 'विलंबित', expectedMr: 'मुदत संपलेली', expectedTa: 'காலாவதியானது' },
  { key: 'status.abnormal', expectedHi: 'असामान्य सीमा', expectedMr: 'असामान्य श्रेणी', expectedTa: 'அசாதாரண வரம்பு' },
  { key: 'status.normal', expectedHi: 'सामान्य', expectedMr: 'सामान्य', expectedTa: 'இயல்பானது' }
];

for (const item of canonicalStatuses) {
  const hi = translateWithFallback(item.key, 'hi-IN');
  testAssert(hi.text === item.expectedHi, `Status '${item.key}' in Hindi must be '${item.expectedHi}', got '${hi.text}'`);

  const mr = translateWithFallback(item.key, 'mr-IN');
  testAssert(mr.text === item.expectedMr, `Status '${item.key}' in Marathi must be '${item.expectedMr}', got '${mr.text}'`);

  const ta = translateWithFallback(item.key, 'ta-IN');
  testAssert(ta.text === item.expectedTa, `Status '${item.key}' in Tamil must be '${item.expectedTa}', got '${ta.text}'`);

  // Ensure English translation is clean and never appended to Hindi
  const en = translateWithFallback(item.key, 'en-IN');
  testAssert(!hi.text.includes(en.text), `Hindi status ${hi.text} must NOT contain English string ${en.text}`);
}

console.log(`  ✓ Canonical status badges verified (${assertionCount} total assertions)`);

// ============================================================================
// SUITE 5: SINGLE KEY FALLBACK ISOLATION (NON-CASCADE)
// ============================================================================
console.log('\n--- Suite 5: Single-Key Fallback Isolation ---');

// Test that requesting an unknown/untranslated key in Hindi falls back ONLY for that key,
// and doesn't pollute subsequent translations or mutate state.
const unknownRes = translateWithFallback('non_existent.dummy_key', 'hi-IN', undefined, 'Fallback Display');
testAssert(unknownRes.isFallback === true, 'Unknown key must be flagged as fallback');
testAssert(unknownRes.text === 'Fallback Display', `Unknown key must return fallback override, got '${unknownRes.text}'`);

// Immediately verify known key is still translated in Hindi
const knownRes = translateWithFallback('vitals.title', 'hi-IN');
testAssert(knownRes.isFallback === false, 'Known key must NOT fall back');
testAssert(knownRes.text === 'स्वास्थ्य अवलोकन', `vitals.title in Hindi must be 'स्वास्थ्य अवलोकन', got '${knownRes.text}'`);

// Test short code resolution (e.g. 'mr' resolves when 'mr-IN' requested)
const shortCodeRes = translateWithFallback('vitals.title', 'mr');
testAssert(shortCodeRes.text === 'आरोग्य स्नॅपशॉट', `vitals.title with short code 'mr' must be 'आरोग्य स्नॅपशॉट', got '${shortCodeRes.text}'`);

console.log(`  ✓ Single-key fallback isolation verified (${assertionCount} total assertions)`);

// ============================================================================
// SUITE 6: CLINICAL BIOMETRICS & CONSTANT PRESERVATION
// ============================================================================
console.log('\n--- Suite 6: Clinical Biometrics & Unit Preservation ---');

// Vitals labels
const bpLabel = translateWithFallback('vitals.bp', 'hi-IN');
testAssert(bpLabel.text === 'रक्तचाप', `BP in Hindi must be 'रक्तचाप', got '${bpLabel.text}'`);

const pulseLabel = translateWithFallback('vitals.pulse', 'hi-IN');
testAssert(pulseLabel.text === 'नाड़ी (Pulse)', `Pulse in Hindi must be 'नाड़ी (Pulse)', got '${pulseLabel.text}'`);

const glucoseLabel = translateWithFallback('vitals.glucose', 'hi-IN');
testAssert(glucoseLabel.text === 'रक्त शर्करा', `Glucose in Hindi must be 'रक्त शर्करा', got '${glucoseLabel.text}'`);

const spo2Label = translateWithFallback('vitals.spo2', 'hi-IN');
testAssert(spo2Label.text === 'ऑक्सीजन (SpO2)', `SpO2 in Hindi must be 'ऑक्सीजन (SpO2)', got '${spo2Label.text}'`);

// Emergency Helplines
const amb = translateWithFallback('helpline.ambulance', 'hi-IN');
testAssert(amb.text === 'एम्बुलेंस (टोल-फ्री)', `Ambulance in Hindi must be 'एम्बुलेंस (टोल-फ्री)', got '${amb.text}'`);

const dial108 = translateWithFallback('helpline.dial_108', 'hi-IN');
testAssert(dial108.text === 'डायल 108', `Dial 108 in Hindi must be 'डायल 108', got '${dial108.text}'`);

const dial104 = translateWithFallback('helpline.dial_104', 'hi-IN');
testAssert(dial104.text === 'डायल 104', `Dial 104 in Hindi must be 'डायल 104', got '${dial104.text}'`);

console.log(`  ✓ Clinical biometrics & helplines verified (${assertionCount} total assertions)`);

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log(`\n======================================================================`);
console.log(`🎉 ALL ${assertionCount} TEST ASSERTIONS PASSED SUCCESSFULLY!`);
console.log(`Status: MULTILINGUAL_UI_READY - Zero Bilingual Concatenations Detected`);
console.log(`======================================================================\n`);
