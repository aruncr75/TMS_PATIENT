import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRunPatient, mintRefreshToken, writeRunPatient } from './support/auth'

const here = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_DIR =
  process.env.E2E_BACKEND_DIR ?? path.resolve(here, '../../O1-TOCKEN MANAGEMENT SYSTEM/backend')

export default async function globalSetup(): Promise<void> {
  // Idempotent seed so the patient/doctor/slots exist. Best-effort: a warning here is
  // fine if the DB is already seeded; the sanity-check mint below fails loudly if the
  // seeded patient is genuinely missing (a clear signal before the suite runs).
  try {
    execSync('bun run seed', { cwd: BACKEND_DIR, stdio: 'inherit' })
  } catch (err) {
    console.warn(`[global-setup] seed step failed (continuing): ${(err as Error).message}`)
  }

  // Fresh patient per run → empty appointment list (no statuses accumulated from prior
  // runs, no waitlist collisions). All worker processes read its phone from a file.
  const phone = await createRunPatient()
  writeRunPatient(phone)

  // Fail fast if the auth seam is broken (DB unreachable / patient missing). Each test
  // mints its own fresh token via the fixture; this just verifies the path works.
  await mintRefreshToken(phone)
  console.log(`[global-setup] seed + fresh patient ${phone} + auth-seam check OK`)
}
