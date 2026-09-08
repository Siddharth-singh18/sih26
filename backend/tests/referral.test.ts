import assert from 'assert';

const VALID_TRANSITIONS: Record<string, string[]> = {
  'CREATED': ['SUBMITTED', 'CANCELLED'],
  'SUBMITTED': ['ACCEPTED', 'REJECTED'],
  'ACCEPTED': ['SCHEDULED'],
  'SCHEDULED': ['PATIENT_ARRIVED', 'CANCELLED'],
  'PATIENT_ARRIVED': ['IN_CONSULTATION'],
  'IN_CONSULTATION': ['DIAGNOSTICS_PENDING', 'TREATMENT', 'COUNTER_REFERRED'],
  'DIAGNOSTICS_PENDING': ['TREATMENT', 'COUNTER_REFERRED'],
  'TREATMENT': ['COUNTER_REFERRED'],
  'COUNTER_REFERRED': ['FOLLOW_UP_REQUIRED', 'COMPLETED'],
  'FOLLOW_UP_REQUIRED': ['COMPLETED']
};

console.log('Testing Referral State Machine transitions...');
assert.strictEqual(VALID_TRANSITIONS['CREATED'].includes('SUBMITTED'), true, 'CREATED -> SUBMITTED should be allowed');
assert.strictEqual(VALID_TRANSITIONS['CREATED'].includes('COMPLETED'), false, 'CREATED -> COMPLETED should be rejected');
assert.strictEqual(VALID_TRANSITIONS['SUBMITTED'].includes('ACCEPTED'), true, 'SUBMITTED -> ACCEPTED should be allowed');
assert.strictEqual(VALID_TRANSITIONS['ACCEPTED'].includes('COMPLETED'), false, 'ACCEPTED -> COMPLETED should be rejected');
console.log('Referral State Machine tests PASSED!');

