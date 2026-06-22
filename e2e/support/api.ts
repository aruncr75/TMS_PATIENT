import { randomUUID } from 'node:crypto'
import { type APIRequestContext, request } from '@playwright/test'
import { BACKEND_URL, CLINIC_TZ, DOCTOR_EMAIL, DOCTOR_PASSWORD } from './env'
import { mintRefreshToken } from './auth'
import type { BookingConfirmationView, DoctorCardView, HoldResult, SlotOption } from '../../src/types/api'

// ── Clinic-local date helpers ───────────────────────────────────────────────────
// Asia/Kolkata has no DST, so adding 24h increments and formatting in the zone is
// stable. en-CA formats as YYYY-MM-DD.

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: CLINIC_TZ, weekday: 'short' })

/** Clinic-local YYYY-MM-DD `offsetDays` from now. */
export function clinicDate(offsetDays = 0): string {
  return dateFmt.format(new Date(Date.now() + offsetDays * 86_400_000))
}

/** The next clinic-local date (within `maxAhead` days) that is a Sat/Sun. */
export function nextWeekendDate(maxAhead = 14): string {
  for (let i = 1; i <= maxAhead; i++) {
    const d = new Date(Date.now() + i * 86_400_000)
    const wd = weekdayFmt.format(d)
    if (wd === 'Sat' || wd === 'Sun') return dateFmt.format(d)
  }
  throw new Error('no weekend date found within range')
}

// ── API contexts ────────────────────────────────────────────────────────────────

export async function bearerContext(accessToken: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: BACKEND_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  })
}

/** An authed context for the seeded patient (session minted via the refresh-token seam). */
export async function patientContext(phone?: string): Promise<APIRequestContext> {
  const refreshToken = await mintRefreshToken(phone)
  const anon = await request.newContext({ baseURL: BACKEND_URL })
  const res = await anon.post('/auth/refresh', { data: { refreshToken } })
  if (!res.ok()) throw new Error(`refresh failed: ${res.status()} ${await res.text()}`)
  const { accessToken } = (await res.json()) as { accessToken: string }
  await anon.dispose()
  return bearerContext(accessToken)
}

/** An authed context for a staff member (default: the seeded admin — has every queue permission). */
export async function staffContext(
  email = 'admin@clinic.test',
  password = DOCTOR_PASSWORD,
): Promise<APIRequestContext> {
  const anon = await request.newContext({ baseURL: BACKEND_URL })
  const res = await anon.post('/auth/staff/login', { data: { email, password } })
  if (!res.ok()) throw new Error(`staff login failed: ${res.status()} ${await res.text()}`)
  const { accessToken } = (await res.json()) as { accessToken: string }
  await anon.dispose()
  return bearerContext(accessToken)
}

// ── Domain helpers (REST arrange) ────────────────────────────────────────────────

/** The seeded "Dr. Dev" — the only doctor with a working calendar + slots. */
export async function seededDoctorId(ctx: APIRequestContext): Promise<string> {
  const res = await ctx.get('/doctors')
  if (!res.ok()) throw new Error(`GET /doctors -> ${res.status()}`)
  const doctors = (await res.json()) as DoctorCardView[]
  const dev = doctors.find((d) => d.displayName === 'Dr. Dev')
  if (!dev) throw new Error('seeded "Dr. Dev" not found — run backend seed')
  return dev.id
}

export interface OpenSlotDay {
  date: string
  slots: SlotOption[]
}

/** First clinic-local date (today..+maxAhead) with ≥1 open slot for the doctor. */
export async function findOpenSlotDay(
  ctx: APIRequestContext,
  doctorId: string,
  maxAhead = 14,
): Promise<OpenSlotDay> {
  for (let i = 0; i <= maxAhead; i++) {
    const date = clinicDate(i)
    const res = await ctx.get(`/doctors/${doctorId}/availability`, { params: { date } })
    if (!res.ok()) continue
    const slots = (await res.json()) as SlotOption[]
    if (slots.length > 0) return { date, slots }
  }
  throw new Error(`no open slot found for doctor ${doctorId} within ${maxAhead} days`)
}

export interface BookedAppointment {
  appointmentId: string
  slotId: string
  doctorId: string
  date: string
  startAt: string
}

/** Book the first open slot for the doctor (hold → confirm), as the patient. */
export async function bookFirstOpenSlot(
  ctx: APIRequestContext,
  doctorId: string,
): Promise<BookedAppointment> {
  const { date, slots } = await findOpenSlotDay(ctx, doctorId)
  const slot = slots[0]

  const holdRes = await ctx.post('/appointments/holds', { data: { slotId: slot.slotId } })
  if (!holdRes.ok()) throw new Error(`hold failed: ${holdRes.status()} ${await holdRes.text()}`)
  const hold = (await holdRes.json()) as HoldResult

  const confirmRes = await ctx.post('/appointments', {
    headers: { 'idempotency-key': randomUUID() },
    data: { slotId: slot.slotId, holdId: hold.holdId, consultationType: 'free' },
  })
  if (!confirmRes.ok()) throw new Error(`confirm failed: ${confirmRes.status()} ${await confirmRes.text()}`)
  const booking = (await confirmRes.json()) as BookingConfirmationView

  return { appointmentId: booking.id, slotId: slot.slotId, doctorId, date, startAt: slot.startAt }
}

/** Cancel an appointment (triggers waitlist promotion if a waiter exists for that day). */
export async function cancelAppointmentApi(ctx: APIRequestContext, appointmentId: string): Promise<void> {
  const res = await ctx.post(`/appointments/${appointmentId}/cancel`, {
    headers: { 'idempotency-key': randomUUID() },
  })
  if (!res.ok()) throw new Error(`cancel failed: ${res.status()} ${await res.text()}`)
}
