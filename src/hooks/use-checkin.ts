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
const SESSIONS_KEY = 'checkin:sessions'

export interface CheckInSession {
  appointmentId: string | null
  doctorId: string
  serviceDate: string
  tokenNumber: number
  tier: CheckInView['tier']
  queueEntryId: string
}

export function readAllCheckInSessions(): Record<string, CheckInSession> {
  const map: Record<string, CheckInSession> = {}

  const rawMulti = sessionStorage.getItem(SESSIONS_KEY)
  if (rawMulti) {
    try {
      const parsed = JSON.parse(rawMulti) as Record<string, CheckInSession>
      Object.assign(map, parsed)
    } catch {
      // ignore
    }
  }

  const rawSingle = sessionStorage.getItem(SESSION_KEY)
  if (rawSingle) {
    try {
      const single = JSON.parse(rawSingle) as CheckInSession
      const key = single.appointmentId ?? single.queueEntryId
      if (key && !map[key]) {
        map[key] = single
      }
    } catch {
      // ignore
    }
  }

  return map
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
  const key = view.appointmentId ?? view.queueEntryId

  const sessions = readAllCheckInSessions()
  sessions[key] = session
  sessionStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function readCheckInSession(key?: string | null): CheckInSession | null {
  const sessions = readAllCheckInSessions()
  const list = Object.values(sessions)
  if (list.length === 0) return null

  if (key && sessions[key]) {
    return sessions[key]
  }

  const rawSingle = sessionStorage.getItem(SESSION_KEY)
  if (rawSingle) {
    try {
      const single = JSON.parse(rawSingle) as CheckInSession
      if (!key || single.appointmentId === key || single.queueEntryId === key) {
        return single
      }
    } catch {
      // ignore
    }
  }

  return list[list.length - 1] ?? null
}

export function clearCheckInSession(key?: string | null): void {
  const sessions = readAllCheckInSessions()
  if (key && sessions[key]) {
    delete sessions[key]
    sessionStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  } else if (!key) {
    sessionStorage.removeItem(SESSIONS_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    return
  }

  const remaining = Object.values(sessions)
  if (remaining.length > 0) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(remaining[remaining.length - 1]))
  } else {
    sessionStorage.removeItem(SESSIONS_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  }
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
