// Shared E2E configuration. Defaults match the local dev stack (see backend/.env
// and client/.env.local); override via env vars in CI.

export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://token_app:token_app_dev@127.0.0.1:5432/token_mgmt'

/** Backend ORIGIN (no /api prefix) — REST + Socket.IO live here. */
export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:3000'

/** The app under test (vite dev). The offline project overrides this to preview. */
export const APP_ORIGIN = process.env.E2E_APP_ORIGIN ?? 'http://localhost:5173'

/** Seeded dev identities (scripts/seed.ts). */
export const PATIENT_PHONE = process.env.E2E_PATIENT_PHONE ?? '+15555550100'
export const DOCTOR_EMAIL = process.env.E2E_DOCTOR_EMAIL ?? 'doctor@clinic.test'
export const DOCTOR_PASSWORD = process.env.E2E_DOCTOR_PASSWORD ?? 'ChangeMe!dev123'

/** Clinic timezone (seed CLINIC_TZ) — used to compute bookable clinic-local dates. */
export const CLINIC_TZ = process.env.E2E_CLINIC_TZ ?? 'Asia/Kolkata'
