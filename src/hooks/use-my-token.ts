import { useMemo } from 'react'
import type { CheckInSession } from '@/hooks/use-checkin'
import type { PublicQueueEntryView, QueueSnapshot } from '@/types/api'

export interface MyTokenState {
  tokenNumber: number
  /** The patient's live board row, or null once they've been seen / left the board. */
  entry: PublicQueueEntryView | null
  position: number | null
  etaMinutes: number | null
  /** nowServingToken === my token → being seen right now. */
  isServing: boolean
  /** Front of the WAITING subset → you're next. (NOT position === 1: that's the
   *  serving row, which the backend includes in the ordered list.) */
  isNext: boolean
  /** Matched the right board, but my row is gone → served / removed. */
  isDone: boolean
  /** Snapshot is for a different doctor/day → the stored session has expired. */
  isStale: boolean
}

// Derive the patient's standing from the public board. Correctness rules:
//  • Match on (doctorId, serviceDate, tokenNumber) — token numbers reset per day, so
//    tokenNumber alone could point at a stranger.
//  • "You're next" is the front of the waiting subset, not position === 1.
//  • My row leaves entries[] once served/removed → report `isDone`, never read
//    `.position` off undefined.
export function useMyToken(
  snapshot: QueueSnapshot | null,
  session: CheckInSession | null,
): MyTokenState | null {
  return useMemo(() => {
    if (!session) return null

    const base: MyTokenState = {
      tokenNumber: session.tokenNumber,
      entry: null,
      position: null,
      etaMinutes: null,
      isServing: false,
      isNext: false,
      isDone: false,
      isStale: false,
    }

    // No board yet (cold start) — show the token, derive nothing.
    if (!snapshot) return base

    // Different doctor/day → the stored session is stale.
    if (snapshot.doctorId !== session.doctorId || snapshot.serviceDate !== session.serviceDate) {
      return { ...base, isStale: true }
    }

    const entry = snapshot.entries.find((e) => e.tokenNumber === session.tokenNumber) ?? null

    // Right board, but our row is gone → we've been seen / removed.
    if (!entry) return { ...base, isDone: true }

    const isServing = entry.status === 'serving' || snapshot.nowServingToken === session.tokenNumber

    const isWaiting = (e: PublicQueueEntryView) => e.status === 'waiting' || e.status === 'skipped'

    // Front of the waiting subset: still waiting, and no other waiting row sits ahead.
    const isNext =
      !isServing &&
      isWaiting(entry) &&
      !snapshot.entries.some(
        (e) => e.tokenNumber !== entry.tokenNumber && isWaiting(e) && e.position < entry.position,
      )

    return {
      ...base,
      entry,
      position: entry.position,
      etaMinutes: entry.etaMinutes,
      isServing,
      isNext,
    }
  }, [snapshot, session])
}
