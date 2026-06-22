import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { ulid } from 'ulid'
import { APP_ORIGIN, DATABASE_URL, PATIENT_PHONE } from './env'

// ── Run-scoped test patient ─────────────────────────────────────────────────────
// Each suite run gets its OWN fresh patient (created in global-setup) so the patient's
// appointment list starts empty — no statuses accumulated from prior runs (which once
// crashed StatusBadge with an unmapped status), no ALREADY_WAITLISTED collisions. The
// chosen phone is written to a file all worker processes read.

const here = path.dirname(fileURLToPath(import.meta.url))
const RUN_PATIENT_FILE = path.resolve(here, '../.auth/run-patient.json')

let cachedPhone: string | null = null
/** The current run's patient phone (falls back to the seed patient if not created yet). */
export function runPatientPhone(): string {
  if (cachedPhone) return cachedPhone
  try {
    cachedPhone = (JSON.parse(readFileSync(RUN_PATIENT_FILE, 'utf8')) as { phone: string }).phone
  } catch {
    cachedPhone = PATIENT_PHONE
  }
  return cachedPhone
}

/** Create a fresh patient (users + profile + patient role) and return its phone. */
export async function createRunPatient(): Promise<string> {
  const phone = `+19${String(Date.now()).slice(-9)}` // unique, E.164-shaped
  const sql = postgres(DATABASE_URL)
  try {
    const userId = ulid()
    await sql`insert into users (id, kind) values (${userId}, 'patient')`
    await sql`
      insert into patient_profiles (id, user_id, phone, full_name)
      values (${ulid()}, ${userId}, ${phone}, 'E2E Patient')`
    const [role] = await sql<{ id: string }[]>`select id from roles where key = 'patient' limit 1`
    if (!role) throw new Error('patient role missing — run the backend seed first')
    await sql`insert into user_roles (user_id, role_id) values (${userId}, ${role.id})`
    return phone
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/** Persist the run patient's phone so every worker process resolves the same identity. */
export function writeRunPatient(phone: string): void {
  mkdirSync(path.dirname(RUN_PATIENT_FILE), { recursive: true })
  writeFileSync(RUN_PATIENT_FILE, JSON.stringify({ phone }, null, 2))
  cachedPhone = phone
}

// ── Auth seam ─────────────────────────────────────────────────────────────────
// The login OTP is stored only as a one-way HMAC in Redis, so the happy-path login UI
// can't be automated. Instead we mint a real session the same way the backend would:
// insert ONE refresh_tokens row for the patient and hand the app the plaintext token
// via localStorage. On boot, hydrateSession() POSTs it to /auth/refresh, the backend
// validates it against this row, and mints an access token — a genuine authenticated
// session against the real backend, no OTP.
//
// Only id/user_id/token_hash/family_id/expires_at need supplying: id + family_id are
// app-generated ULIDs (ulidPk has no DB default); version/created_at/updated_at all
// carry DB defaults (see backend/.../db/columns.ts).

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000

export async function mintRefreshToken(phone = runPatientPhone()): Promise<string> {
  const sql = postgres(DATABASE_URL)
  try {
    const rows = await sql<{ userId: string }[]>`
      select user_id as "userId" from patient_profiles where phone = ${phone} limit 1`
    if (rows.length === 0) {
      throw new Error(`No patient_profile for ${phone}. Run the backend seed / global-setup first.`)
    }
    const userId = rows[0].userId
    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
    await sql`
      insert into refresh_tokens (id, user_id, token_hash, family_id, expires_at)
      values (${ulid()}, ${userId}, ${tokenHash}, ${ulid()}, ${expiresAt})`
    return token
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/** Look up the patient's profile id (patient_profiles.id) for arrange/teardown. */
export async function patientProfileId(phone = runPatientPhone()): Promise<string> {
  const sql = postgres(DATABASE_URL)
  try {
    const rows = await sql<{ id: string }[]>`
      select id from patient_profiles where phone = ${phone} limit 1`
    if (rows.length === 0) throw new Error(`No patient_profile for ${phone}.`)
    return rows[0].id
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/** A Playwright storageState that seeds localStorage['refresh_token'] for the app origin. */
export function storageStateFor(refreshToken: string, origin = APP_ORIGIN) {
  return {
    cookies: [],
    origins: [{ origin, localStorage: [{ name: 'refresh_token', value: refreshToken }] }],
  }
}
