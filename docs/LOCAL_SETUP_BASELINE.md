# AyuSync Local Setup Baseline

## Database Foundation
- **PostgreSQL Server**: PostgreSQL 15.19 on x86_64-pc-linux-musl
- **Container Name**: `ayusync-postgres-1`
- **Port**: 5432 (mapped to `0.0.0.0:5432`)
- **Database Name**: `ayusync`
- **Database User**: `ayusync` (dedicated role with full schema and table permissions)
- **Password Storage**: Stored strictly in local untracked `.env` (`DATABASE_URL="postgresql://ayusync:****@localhost:5432/ayusync?schema=public"`)
- **Prisma Migrations**: `20260901184019_init` verified and up to date (0 pending migrations)
- **Prisma Generator**: Client generated successfully (`v5.22.0`)
- **Seed Status**: Successfully seeded and verified against PostgreSQL:
  - 11 Users (3 Doctors, 3 Frontline Workers, 5 Patients)
  - 3 Roles (`DOCTOR`, `WORKER`, `PATIENT`)
  - 16 Permissions with least-privilege scoping (`PATIENT` has `patient.read`, `facility.read`, `referral.read`, `queue.read`)
  - 5 Facilities (Baramati CHC, Pune District Hospital, Khandala PHC, Saswad PHC, Junnar CHC)
  - 12 Realistic Patient domain profiles with ABHA IDs
  - Longitudinal encounters, vitals, symptoms, assessments, referrals, appointments, follow-ups, and notifications

## Service Ports & Configuration
- **Backend Port**: `5000` (`http://localhost:5000`)
- **Frontend Port**: `5173` (`http://localhost:5173`)
- **Frontend API Base URL**: `VITE_API_URL=http://localhost:5000` (verified in `web/.env`)
- **Health Check Endpoint**: `GET http://localhost:5000/health` (HTTP 200 OK)

