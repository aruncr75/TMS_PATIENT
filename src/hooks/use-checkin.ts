import { useMutation, useQueryClient } from '@tanstack/react-query'
import { selfCheckIn } from '@/lib/api/checkin'
import { clearKey, getOrCreateKey } from '@/lib/idempotency'
import { getApiError } from '@/lib/api/error'
import { appointmentKey } from '@/hooks/use-appointment'
import { appointmentsKey } from '@/hooks/use-appointments'
import type { CheckInView } from '@/types/api'

// The patient's active check-in, persisted so the live-queue tracker survives a tab
// reload. sessionStorage (not localStorage): a token is per-visit and must not leak
// across sessions — and the tracker matches the public board on (doctor, date, token).
const SESSION_KEY = 'checkin:session'

export interface CheckInSession {
  appointmentId: string | null
  doctorId: string
  serviceDate: string
  tokenNumber: number
  tier: CheckInView['tier']
  queueEntryId: string
}

export function saveCheckInSession(view: CheckInView): void {
  const session: CheckInSession = {
    appointmentId: view.appointmentId,
    doctorId: view.doctorId,
    serviceDate: view.serviceDate,
    tokenNumber: view.tokenNumber,
    tier: view.tier,
    queueEntryId: view.queueEntryId,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function readCheckInSession(): CheckInSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CheckInSession
  } catch {
    return null
  }
}

export function clearCheckInSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

// The check-in POST has no body, so the key is stable per appointment — a double-tap
// or 401-refresh retry replays the same token.
function checkInOp(id: string): string {
  return `checkin:${id}`
}

// Self check-in (Phase 5). On success we stash the issued token + doctor + service
// date so the /queue tracker can locate the patient's row on the public board, then
// refresh the appointment reads (status moved confirmed → checked_in).
export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<CheckInView> => {
      const op = checkInOp(id)
      try {
        return await selfCheckIn(id, getOrCreateKey(op))
      } catch (err) {
        // Defensive: if the key was somehow reused against a different request,
        // mint a fresh one and retry once (same recovery as booking confirm).
        if (getApiError(err).code === 'IDEMPOTENCY_KEY_REUSED') {
          clearKey(op)
          return await selfCheckIn(id, getOrCreateKey(op))
        }
        throw err
      }
    },
    onSuccess: (view, id) => {
      clearKey(checkInOp(id))
      saveCheckInSession(view)
      void qc.invalidateQueries({ queryKey: appointmentsKey })
      void qc.invalidateQueries({ queryKey: appointmentKey(id) })
    },
  })
}
