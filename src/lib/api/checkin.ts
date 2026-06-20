import { api } from '@/lib/api/client'
import type { CheckInView, QueueSnapshot } from '@/types/api'

// Phase 5 — self check-in + the public queue board.

// POST /appointments/:id/check-in. Issues the patient's queue token and moves the
// appointment confirmed → checked_in. The `idempotency-key` header is OPTIONAL on
// this endpoint (unlike confirm/cancel) but we always send one so a double-tap or a
// 401-refresh retry returns the SAME token rather than enqueuing twice.
export async function selfCheckIn(id: string, idempotencyKey: string): Promise<CheckInView> {
  // Body is `{}` (not `null`): the `api` instance defaults Content-Type to
  // application/json, so a `null` body serializes to the string "null" and the
  // backend's strict JSON parser 400s it. This endpoint ignores the body; the
  // idempotency key rides in the header.
  const { data } = await api.post<CheckInView>(`/appointments/${id}/check-in`, {}, {
    headers: { 'idempotency-key': idempotencyKey },
  })
  return data
}

// GET /doctors/:doctorId/queue — the queue board. "Token-only" (§14.1) means the
// RESPONSE is PHI-free (token numbers only), NOT that it's unauthenticated: the
// route has no @Public(), so the global JwtAuthGuard requires a valid token (any
// authenticated caller). Verified at runtime — 401 without a Bearer. So it must go
// through `api` (attaches the token + 401-refresh), not `publicApi`. The patient is
// always authenticated behind AuthGuard when viewing the queue. Used as the
// cold-start seed and the reconnect fallback for the live socket.
export async function getQueueSnapshot(doctorId: string): Promise<QueueSnapshot> {
  const { data } = await api.get<QueueSnapshot>(`/doctors/${doctorId}/queue`)
  return data
}
