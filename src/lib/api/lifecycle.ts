import { api } from '@/lib/api/client'
import type { CancellationView, RescheduleView } from '@/types/api'

// Appointment lifecycle mutations (Phase 4): cancel + reschedule. Both REQUIRE an
// `idempotency-key` header (400 otherwise); the key is minted/managed by the
// calling hook so it survives 401-refresh retries and double-taps.

// ── Cancel ────────────────────────────────────────────────────────────────────
export async function cancelAppointment(
  id: string,
  idempotencyKey: string,
): Promise<CancellationView> {
  const { data } = await api.post<CancellationView>(`/appointments/${id}/cancel`, null, {
    headers: { 'idempotency-key': idempotencyKey },
  })
  return data
}

// ── Reschedule ────────────────────────────────────────────────────────────────
export interface RescheduleInput {
  newSlotId: string
  holdId: string
}

// Hold-first, exactly like booking: hold the target slot, then call reschedule
// with `{ newSlotId, holdId }`. Can lose a last-slot race → SLOT_UNAVAILABLE whose
// `details.alternatives` carries the offered alternatives.
export async function rescheduleAppointment(
  id: string,
  input: RescheduleInput,
  idempotencyKey: string,
): Promise<RescheduleView> {
  const { data } = await api.post<RescheduleView>(`/appointments/${id}/reschedule`, input, {
    headers: { 'idempotency-key': idempotencyKey },
  })
  return data
}
