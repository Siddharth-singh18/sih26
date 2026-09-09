# AyuSync Nearby Care & Live Facility Routing Architecture

## 1. Overview
The AyuSync Nearby Care routing service bridges rural Indian patients and frontline healthcare workers with live regional healthcare infrastructure. Rather than displaying static Google Maps pins or hypothetical hospital directories, AyuSync calculates optimal facility options using live PostgreSQL capacity telemetry, active consultation queue depths, and precise Haversine geographic distance.

---

## 2. Haversine Distance & Transit Estimation

### Mathematical Formulation
The distance $d$ between patient coordinates $(\phi_1, \lambda_1)$ and facility coordinates $(\phi_2, \lambda_2)$ is computed via the great-circle Haversine formula on a spherical Earth with mean radius $R = 6,371\text{ km}$:

$$\Delta \phi = \phi_2 - \phi_1, \quad \Delta \lambda = \lambda_2 - \lambda_1$$
$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1) \cdot \cos(\phi_2) \cdot \sin^2\left(\frac{\Delta \lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$
$$d = R \cdot c$$

### Transit Duration Caveat
Road conditions, terrain, and traffic in rural Indian districts vary considerably. Therefore, all estimated travel times are computed using a baseline average speed of $35\text{ km/h}$ and **MUST ALWAYS** be explicitly labeled with the mandatory **`(ESTIMATED)`** caveat in both API responses and UI displays:

$$\text{travelTimeMinutes} = \text{round}\left(\frac{d}{35} \times 60\right)$$
$$\text{travelTimeDisplay} = \text{"} \sim X \text{ mins (ESTIMATED)}"$$

---

## 3. Real-Time Telemetry & Scoring Engine

Each candidate facility is evaluated across multiple dimensions fetched directly from PostgreSQL:

1. **Physical Proximity**: Distance penalty proportional to urgency (Emergency: 0.35/km; Routine: 0.15/km).
2. **Readiness Score**: Direct facility operational readiness score ($0 - 100$).
3. **Live Bed Availability**:
   - General Ward beds available ($+6$ boost)
   - ICU beds available ($+12$ boost)
   - Oxygen-supported beds available ($+8$ boost)
   - Maternity beds available ($+5$ boost)
   - NICU / Pediatric beds available ($+8$ boost)
4. **Queue Load**:
   - Active waiting queue count ($WAITING + PRIORITY + IN\_CONSULTATION$).
   - Facilities with zero queue receive a zero-wait bonus ($+5$).
   - Facilities with active queues incur a proportional penalty ($-2$ per waiting patient).
5. **Operational Status**:
   - `OPEN`: $+10$ bonus
   - `OVERCAPACITY`: $-25$ penalty
   - `CLOSED`: Excluded from candidate pool

---

## 4. API & Data Contract

### REST Endpoints
- `POST /api/routing/nearby`:
  - **Request Body**: `{ latitude: number, longitude: number, maxDistanceKm?: number, filterType?: string, urgency?: "ROUTINE" | "URGENT" | "EMERGENCY" }`
  - **Response**: Array of `NearbyFacilityResult` sorted by optimal score.
- `GET /api/facilities`: Returns complete district facility roster with capacities.

### NearbyFacilityResult Contract
```typescript
interface NearbyFacilityResult {
  id: string;
  name: string;
  type: 'PHC' | 'CHC' | 'SUB_DISTRICT' | 'DISTRICT_HOSPITAL';
  address: string;
  contactPhone: string;
  distanceKm: number;
  travelTimeMinutes: number;
  travelTimeLabel: string; // e.g. "~25 mins (ESTIMATED)"
  readinessScore: number;
  status: 'OPEN' | 'OVERCAPACITY' | 'CLOSED';
  activeQueueCount: number;
  capacities: {
    category: string;
    total: number;
    occupied: number;
    available: number;
  }[];
  specialties: string[];
}
```

---

## 5. Frontend User Experience Integration

### Patient Dashboard Integration
1. **Header Action**: The cohesive patient identity card in [`web/src/pages/PatientDashboard.tsx`](file:///home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean/web/src/pages/PatientDashboard.tsx) features a prominent **"Find Nearby Care"** action button alongside **"Book Consultation"**.
2. **Interactive Modal**: Clicking launches [`web/src/components/facility/FindNearbyCareModal.tsx`](file:///home/siddharth-singh18/Development/swasthyaSetu/AyuSync-clean/web/src/components/facility/FindNearbyCareModal.tsx), offering:
   - Live browser geolocation detection with fallback to district center.
   - Capability filters: All, Emergency Care, ICU Beds, Oxygen Support, Maternity Care.
   - Live capacity breakdown per facility card.
   - Direct phone call trigger to facility triage desk.
3. **Dispensary Stock Integration**: In the Active Medications card, patients are informed of the schema boundary regarding live stock counters and presented with a direct button to **"Find Facilities with Dispensaries"** to navigate to the nearest clinic pharmacy.
