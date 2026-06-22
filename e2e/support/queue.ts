import { randomUUID } from 'node:crypto'
import { type APIRequestContext } from '@playwright/test'
import postgres from 'postgres'
import { DATABASE_URL } from './env'
import type { CheckInView, QueueSnapshot } from '../../src/types/api'

// Helpers to drive the live queue deterministically. The check-in WINDOW is enforced
// for self AND manual modes, and right now no seeded slot is in-window — so we populate
// the board via WALK-INS (no window), which produce a real queue entry + Socket.IO
// frames exactly like a checked-in booking. A staff/admin token drives the privileged
// call-next/complete transitions; the patient app under test observes them live.

/** Remove any pre-existing live entries so our walk-in is the only one (deterministic). */
export async function clearQueueDb(doctorId: string, serviceDate: string): Promise<void> {
  const sql = postgres(DATABASE_URL)
  try {
    await sql`
      update queue_entries
         set status = 'removed', updated_at = now()
       where doctor_id = ${doctorId}
         and service_date = ${serviceDate}
         and status in ('waiting', 'serving', 'skipped')`
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/** Shift a slot's start to NOW so a confirmed appointment falls inside the check-in
 *  window (start − window ≤ now ≤ start + grace). Lets us drive the self check-in
 *  happy path against real seeded slots, which are never naturally in-window. */
export async function shiftSlotToNow(slotId: string): Promise<void> {
  const sql = postgres(DATABASE_URL)
  try {
    await sql`update slots set start_at = now(), updated_at = now() where id = ${slotId}`
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/** Declare (or clear, with 0) the doctor's running-late delay for today. Folds into the
 *  read-time ETA the patient board shows. Staff/admin only (availability.manage). */
export async function reportRunningLate(
  staffCtx: APIRequestContext,
  doctorId: string,
  delayMinutes: number,
): Promise<void> {
  const res = await staffCtx.post(`/doctors/${doctorId}/running-late`, {
    headers: { 'idempotency-key': randomUUID() },
    data: { delayMinutes },
  })
  if (!res.ok()) throw new Error(`running-late failed: ${res.status()} ${await res.text()}`)
}

/** Issue a walk-in token for the doctor (no appointment, no check-in window). */
export async function walkIn(staffCtx: APIRequestContext, doctorId: string): Promise<CheckInView> {
  const res = await staffCtx.post('/walk-ins', {
    headers: { 'idempotency-key': randomUUID() },
    data: { doctorId },
  })
  if (!res.ok()) throw new Error(`walk-in failed: ${res.status()} ${await res.text()}`)
  return (await res.json()) as CheckInView
}

export interface CalledEntry {
  queueEntryId: string
  tokenNumber: number
}

/** Call the next waiting token for the doctor (staff CONSULTATION_TRANSITION). */
export async function callNext(staffCtx: APIRequestContext, doctorId: string): Promise<CalledEntry> {
  const res = await staffCtx.post(`/doctors/${doctorId}/queue/call-next`, {
    headers: { 'idempotency-key': randomUUID() },
  })
  if (!res.ok()) throw new Error(`call-next failed: ${res.status()} ${await res.text()}`)
  const view = (await res.json()) as { queueEntryId: string; tokenNumber: number }
  return { queueEntryId: view.queueEntryId, tokenNumber: view.tokenNumber }
}

/** Complete the in-progress token (serving → served). */
export async function completeEntry(staffCtx: APIRequestContext, entryId: string): Promise<void> {
  const res = await staffCtx.post(`/queue/${entryId}/complete`, {
    headers: { 'idempotency-key': randomUUID() },
  })
  if (!res.ok()) throw new Error(`complete failed: ${res.status()} ${await res.text()}`)
}

/** Read the public board (REST seed the app also uses). */
export async function queueSnapshot(
  ctx: APIRequestContext,
  doctorId: string,
): Promise<QueueSnapshot> {
  const res = await ctx.get(`/doctors/${doctorId}/queue`)
  if (!res.ok()) throw new Error(`queue snapshot failed: ${res.status()} ${await res.text()}`)
  return (await res.json()) as QueueSnapshot
}

/**
 * The sessionStorage shape the /queue tracker reads (hooks/use-checkin.ts SESSION_KEY).
 * Built from a walk-in CheckInView so the tracker can locate our token on the board.
 */
export function checkInSessionFrom(view: CheckInView) {
  return {
    appointmentId: view.appointmentId,
    doctorId: view.doctorId,
    serviceDate: view.serviceDate,
    tokenNumber: view.tokenNumber,
    tier: view.tier,
    queueEntryId: view.queueEntryId,
  }
}
