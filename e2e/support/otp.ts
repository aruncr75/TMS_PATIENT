import { createHmac, randomInt } from 'node:crypto'
import Redis from 'ioredis'
import { OTP_PEPPER, OTP_TTL_SECONDS, REDIS_URL } from './env'
import type { OtpPurpose } from '../../../O1-TOCKEN MANAGEMENT SYSTEM/backend/src/domain/identity/otp-sender.port'

// ── OTP seam ──────────────────────────────────────────────────────────────────
// The login/phone-change OTP is stored only as a one-way HMAC in Redis, so the happy
// path can't be driven by reading the code. Instead we reproduce the backend's storage
// exactly — key `otp:<purpose>:<phone>`, field `hash` = HMAC-SHA256(pepper, "phone:code")
// — and write a KNOWN code, then drive the real verify UI. This mirrors how the suite
// already seams auth via direct DB writes (support/auth.ts).
//
// Coupled to two backend internals (both stable dev defaults): OTP_PEPPER and the
// key/hash format in backend/src/modules/auth/otp.service.ts. If either changes, update
// here. `attempts` is reset to 0 so a prior failed verify can't lock our injected code.

function otpHash(phone: string, code: string): string {
  return createHmac('sha256', OTP_PEPPER).update(`${phone}:${code}`).digest('hex')
}

/** Plant a known OTP for (purpose, phone) so the real verify UI succeeds. */
export async function injectOtp(
  purpose: OtpPurpose,
  phone: string,
  code = '000000',
): Promise<void> {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 })
  try {
    const key = `otp:${purpose}:${phone}`
    await redis.hset(key, 'hash', otpHash(phone, code), 'attempts', '0')
    await redis.expire(key, OTP_TTL_SECONDS)
  } finally {
    redis.disconnect()
  }
}

/** A fresh, E.164-shaped phone unused by any prior run (mirrors support/auth.ts). The
 *  2 random trailing digits guard against same-millisecond collisions across tests. */
export function uniquePhone(): string {
  return `+19${String(Date.now()).slice(-7)}${String(randomInt(0, 100)).padStart(2, '0')}`
}
