import { api } from '@/lib/api/client'
import type {
  BookingConfirmationView,
  DoctorCardView,
  HoldResult,
  SlotOption,
} from '@/types/api'

// Booking API (Phase 3): doctor directory → availability → hold → confirm. All
// use the authenticated `api` instance (401 → refresh → retry is handled there).

// ── Doctors ─────────────────────────────────────────────────────────────────
export async function listDoctors(): Promise<DoctorCardView[]> {
  const { data } = await api.get<DoctorCardView[]>('/doctors')
  return data
}

// ── Availability ──────────────────────────────────────────────────────────────
// `date` is a clinic-local 'YYYY-MM-DD'; the server returns UTC ISO slot times.
export async function getAvailability(doctorId: string, date: string): Promise<SlotOption[]> {
  const { data } = await api.get<SlotOption[]>(`/doctors/${doctorId}/availability`, {
    params: { date },
  })
  return data
}

// ── Hold ────────────────────────────────────────────────────────────────────
export async function holdSlot(slotId: string): Promise<HoldResult> {
  const { data } = await api.post<HoldResult>('/appointments/holds', { slotId })
  return data
}

// ── Confirm ───────────────────────────────────────────────────────────────────
export interface ConfirmBookingInput {
  slotId: string
  holdId: string
  dependentId?: string
  consultationType?: 'free' | 'paid'
  reasonForVisit?: string
}

// The `idempotency-key` header is REQUIRED by the backend (400 otherwise) and is
// minted/managed by the caller (use-booking) so it survives 401-refresh retries.
export async function confirmBooking(
  input: ConfirmBookingInput,
  idempotencyKey: string,
): Promise<BookingConfirmationView> {
  const { data } = await api.post<BookingConfirmationView>('/appointments', input, {
    headers: { 'idempotency-key': idempotencyKey },
  })
  return data
}
