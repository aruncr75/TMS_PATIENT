import { randomUUID } from 'node:crypto'
import { type APIRequestContext } from '@playwright/test'
import postgres from 'postgres'
import { ulid } from 'ulid'
import { DATABASE_URL } from './env'
import { patientProfileId } from './auth'
import { bookFirstOpenSlot, cancelAppointmentApi, seededDoctorId } from './api'
import type { WaitlistEntryView } from '../../src/types/api'

export interface ArrangedOffer {
  entryId: string
  doctorId: string
  serviceDate: string
}

/**
 * Arrange a REAL `offered` waitlist entry for the patient, exercising the actual
 * promotion pipeline. The join endpoint refuses to enqueue when the day has a
 * bookable slot (backpressure gate), and fully booking a day needs many distinct
 * patients — so we insert the `waiting` row directly, then book + cancel one slot on
 * that day. The cancel runs `promoteNext()` synchronously, which offers the freed
 * seat to our (sole) waiter. The ACCEPT itself is then driven through the real UI.
 */
export async function arrangeWaitlistOffer(patientCtx: APIRequestContext): Promise<ArrangedOffer> {
  const doctorId = await seededDoctorId(patientCtx)
  const booked = await bookFirstOpenSlot(patientCtx, doctorId) // a slot on day D we can later free
  const serviceDate = booked.date
  const profileId = await patientProfileId()

  const sql = postgres(DATABASE_URL)
  try {
    // Make our patient the sole live waiter for (doctor, day) so promoteNext picks us.
    await sql`
      update waitlist_entries set status = 'cancelled', updated_at = now()
       where doctor_id = ${doctorId} and service_date = ${serviceDate}
         and status in ('waiting', 'offered')`
    await sql`
      insert into waitlist_entries (id, doctor_id, service_date, patient_profile_id, status)
      values (${ulid()}, ${doctorId}, ${serviceDate}, ${profileId}, 'waiting')`
  } finally {
    await sql.end({ timeout: 5 })
  }

  // Free the seat → cancel's promoteNext() offers it to our waiter (synchronous).
  await cancelAppointmentApi(patientCtx, booked.appointmentId)

  for (let i = 0; i < 10; i++) {
    const res = await patientCtx.get('/waitlist')
    const entries = (await res.json()) as WaitlistEntryView[]
    const offered = entries.find(
      (e) => e.doctorId === doctorId && e.serviceDate === serviceDate && e.status === 'offered',
    )
    if (offered) return { entryId: offered.id, doctorId, serviceDate }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('waitlist offer did not materialize after cancel')
}

/** Cancel every live (waiting/offered) waitlist entry for a patient, so a freshly
 * arranged entry is the SOLE card on the list page (deterministic Leave-waitlist test). */
export async function clearWaitlist(profileId: string): Promise<void> {
  const sql = postgres(DATABASE_URL)
  try {
    await sql`
      update waitlist_entries set status = 'cancelled', updated_at = now()
       where patient_profile_id = ${profileId} and status in ('waiting', 'offered')`
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/** Join the waitlist directly via the API (used to assert the list UI without UI driving). */
export async function joinWaitlistApi(
  patientCtx: APIRequestContext,
  doctorId: string,
  date: string,
): Promise<void> {
  const res = await patientCtx.post(`/doctors/${doctorId}/waitlist`, {
    headers: { 'idempotency-key': randomUUID() },
    data: { date, consultationType: 'free' },
  })
  // ALREADY_WAITLISTED is fine — the entry exists either way.
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`join waitlist failed: ${res.status()} ${await res.text()}`)
  }
}
