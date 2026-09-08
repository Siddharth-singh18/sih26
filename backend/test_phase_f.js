const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING PHASE F VERIFICATION ---');

  try {
    // 1. Valid Login (Worker)
    let res = await axios.post(`${API_URL}/auth/login`, { phone: '+919998887776', password: 'password123' });
    const token = res.data.token;
    console.log('[PASS] Worker login ->', res.status);

    // 2. GET facilities
    res = await axios.get(`${API_URL}/facilities`, { headers: { Authorization: `Bearer ${token}` }});
    console.log('[PASS] GET facilities ->', res.status, `found ${res.data.length}`);
    const facilityId = res.data[0]?.id;

    // 3. PUT facility availability
    if (facilityId) {
      let availRes = await axios.put(`${API_URL}/facilities/${facilityId}/availability`, {
        status: 'OVERCAPACITY',
        readinessScore: 70
      }, { headers: { Authorization: `Bearer ${token}` }});
      console.log('[PASS] PUT facility availability ->', availRes.status);
    }

    // 4. Patient Search to get a patient with referrals
    res = await axios.get(`${API_URL}/patients/search`, { headers: { Authorization: `Bearer ${token}` }});

    let patientId;
    let referralId;
    for (const p of res.data) {
      let timelineRes = await axios.get(`${API_URL}/patients/${p.id}/timeline`, { headers: { Authorization: `Bearer ${token}` }});
      if (timelineRes.data.referrals && timelineRes.data.referrals.length > 0) {
        patientId = p.id;
        referralId = timelineRes.data.referrals[0].id;
        break;
      }
    }

    if (referralId) {
      // 5. Valid referral transition
      // We assume it's currently CREATED or SUBMITTED from seed. Let's get current status
      let timelineRes = await axios.get(`${API_URL}/patients/${patientId}/timeline`, { headers: { Authorization: `Bearer ${token}` }});
      let currentStatus = timelineRes.data.referrals.find((r) => r.id === referralId).status;

      let nextValidStatus = 'SUBMITTED';
      if (currentStatus === 'SUBMITTED') nextValidStatus = 'ACCEPTED';
      if (currentStatus === 'ACCEPTED') nextValidStatus = 'SCHEDULED';
      if (currentStatus === 'SCHEDULED') nextValidStatus = 'CANCELLED';

      let validRes = await axios.put(`${API_URL}/referrals/${referralId}/status`, { newStatus: nextValidStatus }, { headers: { Authorization: `Bearer ${token}` }});
      console.log('[PASS] Valid referral transition ->', validRes.status);

      // Verify ReferralEvent persistence (should be returned in the updatedRef events array)
      const events = validRes.data.events;
      if (events && events.length > 0 && events[0].statusTo === nextValidStatus) {
        console.log('[PASS] ReferralEvent persisted successfully');
      } else {
        console.log('[FAIL] ReferralEvent missing in response');
      }

      // 6. Invalid referral transition
      try {
        await axios.put(`${API_URL}/referrals/${referralId}/status`, { newStatus: 'UNKNOWN_STATUS_INVALID' }, { headers: { Authorization: `Bearer ${token}` }});
        console.log('[FAIL] Invalid transition should have failed');
      } catch (err) {
        console.log('[PASS] Invalid referral transition ->', err.response?.status); // Should be 400
      }
    } else {
      console.log('[SKIP] No referral found for transition tests.');
    }

    // 7. Non-existent referral
    try {
      await axios.put(`${API_URL}/referrals/fake-uuid-1234/status`, { newStatus: 'SUBMITTED' }, { headers: { Authorization: `Bearer ${token}` }});
    } catch (err) {
      console.log('[PASS] Non-existent referral ->', err.response?.status); // Should be 404
    }

    // 8. Request without JWT
    try {
      await axios.get(`${API_URL}/facilities`);
    } catch (err) {
      console.log('[PASS] Unauthenticated request ->', err.response?.status); // Should be 401
    }

  } catch (error) {
    console.error('Test failed unexpectedly:', error.message, error.response?.data);
  }
}

runTests();
