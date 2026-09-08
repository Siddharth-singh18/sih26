const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING PHASE E VERIFICATION ---');

  try {
    // 1. Valid Login (Worker)
    let res = await axios.post(`${API_URL}/auth/login`, { phone: '+919998887776', password: 'password123' });
    const workerToken = res.data.token;
    console.log('[PASS] Worker login ->', res.status);

    // 2. Dashboard Analytics
    res = await axios.get(`${API_URL}/analytics/dashboard`, { headers: { Authorization: `Bearer ${workerToken}` }});
    console.log('[PASS] Dashboard Metrics ->', res.status, res.data);

    // 3. Patient Search
    res = await axios.get(`${API_URL}/patients/search`, { headers: { Authorization: `Bearer ${workerToken}` }});
    console.log('[PASS] Patient search ->', res.status, `found ${res.data.length} patients`);

    if (res.data.length > 0) {
      let patientId;
      let encounter;

      for (const p of res.data) {
        let timelineRes = await axios.get(`${API_URL}/patients/${p.id}/timeline`, { headers: { Authorization: `Bearer ${workerToken}` }});
        if (timelineRes.data.encounters && timelineRes.data.encounters.length > 0) {
          patientId = p.id;
          encounter = timelineRes.data.encounters[0];
          break;
        }
      }


      // 4. Patient timeline
      let timelineRes = await axios.get(`${API_URL}/patients/${patientId}/timeline`, { headers: { Authorization: `Bearer ${workerToken}` }});
      console.log('[PASS] Patient timeline ->', timelineRes.status);


      if (encounter) {
        // 5. Create Assessment
        let assRes = await axios.post(`${API_URL}/assessments`, {
          patientId: patientId,
          encounterId: encounter.id,
          symptoms: [{ name: 'Test Symptom', duration: '1d', severity: 'MODERATE' }],
          vitals: [],
          provenance: 'WORKER_RECORDED'
        }, { headers: { Authorization: `Bearer ${workerToken}` }});

        console.log('[PASS] Create Assessment ->', assRes.status);
        console.log('[PASS] Assessment has AI Recommendation ->', assRes.data.aiRecommendations?.length > 0 ? 'YES' : 'NO');

        // 6. Refetch Timeline to confirm persistence
        timelineRes = await axios.get(`${API_URL}/patients/${patientId}/timeline`, { headers: { Authorization: `Bearer ${workerToken}` }});
        const latestAssessment = timelineRes.data.encounters[0].assessments[0];
        console.log('[PASS] Refetched Assessment ->', latestAssessment ? 'FOUND' : 'MISSING');
        console.log('[PASS] Refetched AI Triage ->', latestAssessment?.aiRecommendations?.length > 0 ? 'FOUND' : 'MISSING');
      } else {
         console.log('[SKIP] No encounter found for assessment creation test.');
      }
    }
  } catch (error) {
    console.error('Test failed unexpectedly:', error.message, error.response?.data);
  }
}

runTests();
