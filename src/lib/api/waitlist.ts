import { api } from '@/lib/api/client'
import type {
  BookingConfirmationView,
  JoinWaitlistInput,
  WaitlistEntryView,
} from '@/types/api'

// Waitlist API (Phase 6): join → monitor → accept an offered slot. All routes are
// authenticated (no @Public), so they use the `api` instance (401 → refresh → retry).

// ── Join ──────────────────────────────────────────────────────────────────────
// POST /doctors/:doctorId/waitlist. Body sends `date` (clinic-local YYYY-MM-DD);
// dependentId/consultationType are captured here and carried to the appointment that
// accept eventually creates — the accept step has no chance to set them.
export async function joinWaitlist(
  doctorId: string,
  input: JoinWaitlistInput,
): Promise<WaitlistEntryView> {
  const { data } = await api.post<WaitlistEntryView>(`/doctors/${doctorId}/waitlist`, input)
  return data
}

// ── List ──────────────────────────────────────────────────────────────────────
// GET /waitlist — the caller's own entries.
export async function listWaitlist(): Promise<WaitlistEntryView[]> {
  const { data } = await api.get<WaitlistEntryView[]>('/waitlist')
  return data
}

// ── Leave ─────────────────────────────────────────────────────────────────────
// DELETE /waitlist/:id → the entry's final (cancelled) state.
export async function leaveWaitlist(id: string): Promise<WaitlistEntryView> {
  const { data } = await api.delete<WaitlistEntryView>(`/waitlist/${id}`)
  return data
}

// ── Accept ────────────────────────────────────────────────────────────────────
// POST /waitlist/:id/accept. The `idempotency-key` header is REQUIRED here (the
// backend throws IDEMPOTENCY_KEY_REQUIRED without it), so the caller (use-waitlist)
// always mints one. Returns the confirmed appointment as a BookingConfirmationView.
export async function acceptOffer(
  id: string,
  idempotencyKey: string,
): Promise<BookingConfirmationView> {
  // Body is `{}` (not `null`): the `api` instance defaults Content-Type to
  // application/json, so a `null` body serializes to the string "null", which the
  // backend's strict JSON parser rejects with a 400. The accept endpoint ignores the
  // body; the idempotency key rides in the header.
  const { data } = await api.post<BookingConfirmationView>(`/waitlist/${id}/accept`, {}, {
    headers: { 'idempotency-key': idempotencyKey },
  })
  return data
}
