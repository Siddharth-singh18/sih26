const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING PHASE C VERIFICATION ---');

  try {
    // 1. Health check
    let res = await axios.get('http://localhost:5000/health');
    console.log('[PASS] /health', res.status);

    // 2. Invalid Login
    try {
      await axios.post(`${API_URL}/auth/login`, { phone: 'invalid', password: 'wrong' });
      console.log('[FAIL] Invalid login allowed');
    } catch (e) {
      console.log('[PASS] Invalid login ->', e.response.status);
    }

    // 3. Valid Login (Worker)
    res = await axios.post(`${API_URL}/auth/login`, { phone: '+919998887776', password: 'password123' });
    const workerToken = res.data.token;
    console.log('[PASS] Worker login ->', res.status);

    // 4. Valid Login (Doctor)
    res = await axios.post(`${API_URL}/auth/login`, { phone: '+919876543210', password: 'password123' });
    const doctorToken = res.data.token;
    console.log('[PASS] Doctor login ->', res.status);

    // 5. Patient search without token
    try {
      await axios.get(`${API_URL}/patients/search`);
      console.log('[FAIL] Patient search without token allowed');
    } catch (e) {
      console.log('[PASS] Patient search without token ->', e.response.status);
    }

    // 6. Patient search with valid Worker token
    res = await axios.get(`${API_URL}/patients/search`, { headers: { Authorization: `Bearer ${workerToken}` }});
    console.log('[PASS] Patient search (Worker) ->', res.status, `found ${res.data.length} patients`);

    // 7. Patient timeline with valid token
    if (res.data.length > 0) {
      const patientId = res.data[0].id;
      let timelineRes = await axios.get(`${API_URL}/patients/${patientId}/timeline`, { headers: { Authorization: `Bearer ${workerToken}` }});
      console.log('[PASS] Patient timeline ->', timelineRes.status);
    }

    // 8. Invalid patient
    try {
      await axios.get(`${API_URL}/patients/invalid-id/timeline`, { headers: { Authorization: `Bearer ${workerToken}` }});
      console.log('[FAIL] Invalid patient allowed');
    } catch (e) {
      console.log('[PASS] Invalid patient ->', e.response?.status);
    }

    // 9. Assessment API
    if (res.data.length > 0) {
      const patientId = res.data[0].id;
      let assRes = await axios.get(`${API_URL}/assessments/patient/${patientId}`, { headers: { Authorization: `Bearer ${workerToken}` }});
      console.log('[PASS] Assessment API ->', assRes.status);
    }

    // 10. Facility API
    let facRes = await axios.get(`${API_URL}/facilities/`, { headers: { Authorization: `Bearer ${workerToken}` }});
    console.log('[PASS] Facility API ->', facRes.status);

    // 11. Referral API
    try {
      await axios.put(`${API_URL}/referrals/ref-1/status`, { newStatus: 'ACCEPTED', notes: 'Test note' }, { headers: { Authorization: `Bearer ${workerToken}` }});
      console.log('[PASS] Referral API (Valid transition) -> 200');
    } catch (e) {
      console.log('[FAIL] Referral API (Valid transition) ->', e.response?.status, e.response?.data);
    }

    // 12. Referral API (Invalid transition)
    try {
      await axios.put(`${API_URL}/referrals/ref-1/status`, { newStatus: 'CREATED', notes: 'Test note' }, { headers: { Authorization: `Bearer ${workerToken}` }});
      console.log('[FAIL] Referral API (Invalid transition) allowed -> 200');
    } catch (e) {
      console.log('[PASS] Referral API (Invalid transition) ->', e.response?.status);
    }

    // 13. Queue API
    try {
      let queueRes = await axios.get(`${API_URL}/queue/doctor/doc-1`, { headers: { Authorization: `Bearer ${workerToken}` }});
      console.log('[PASS] Queue API ->', queueRes.status);
    } catch (e) {
      console.log('[FAIL] Queue API ->', e.response?.status, e.response?.data);
    }

  } catch (error) {
    console.error('Test failed unexpectedly:', error.message);
  }
}

runTests();
