import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptOffer,
  joinWaitlist,
  leaveWaitlist,
  listWaitlist,
} from '@/lib/api/waitlist'
import { clearKey, getOrCreateKey } from '@/lib/idempotency'
import { getApiError } from '@/lib/api/error'
import { appointmentsKey } from '@/hooks/use-appointments'
import type {
  BookingConfirmationView,
  JoinWaitlistInput,
  WaitlistEntryView,
} from '@/types/api'

export const waitlistKey = ['waitlist'] as const

// An entry is a live, acceptable offer only while status is `offered`, it carries a
// slot, and the offer window hasn't elapsed. The clock check matters because the
// poll can return an `offered` row a few seconds before the backend's expiry job
// flips it to `expired` — we don't want to surface a 00:00 offer.
export function isActiveOffer(entry: WaitlistEntryView, now: number = Date.now()): boolean {
  return (
    entry.status === 'offered' &&
    entry.offeredSlotId != null &&
    entry.offerExpiresAt != null &&
    new Date(entry.offerExpiresAt).getTime() > now
  )
}

export function findActiveOffer(
  entries: WaitlistEntryView[] | undefined,
): WaitlistEntryView | undefined {
  const now = Date.now()
  return entries?.find((e) => isActiveOffer(e, now))
}

// The caller's waitlist entries. Until Phase 7 (FCM) the offer is surfaced by
// polling: a promotion can arrive at any time while the tab is open, so refetch
// every 30 s. This one query powers both the list page and the app-wide offer
// banner — keep a single source of truth.
export function useWaitlist() {
  return useQuery({
    queryKey: waitlistKey,
    queryFn: listWaitlist,
    refetchInterval: 30_000,
  })
}

// Join a doctor's waitlist for a full day. The join endpoint is NOT idempotent (it
// takes no idempotency-key); a duplicate join is instead rejected with
// ALREADY_WAITLISTED, which the caller messages — so a plain mutation is correct.
export function useJoinWaitlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      doctorId,
      input,
    }: {
      doctorId: string
      input: JoinWaitlistInput
    }): Promise<WaitlistEntryView> => joinWaitlist(doctorId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: waitlistKey })
    },
  })
}

// Drop an entry from the cached list immediately, so the offer banner / list don't
// briefly show a just-removed row during the post-mutation refetch window.
function dropEntry(qc: ReturnType<typeof useQueryClient>, id: string): void {
  qc.setQueryData<WaitlistEntryView[]>(waitlistKey, (prev) => prev?.filter((e) => e.id !== id))
}

// Leave (cancel) a waitlist entry. A double-leave hits WAITLIST_ENTRY_NOT_FOUND,
// which the caller treats as already-removed. Refresh the list either way.
export function useLeaveWaitlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<WaitlistEntryView> => leaveWaitlist(id),
    onSuccess: (_data, id) => dropEntry(qc, id),
    onError: (err, id) => {
      // Already gone server-side → reflect that locally instead of leaving it.
      if (getApiError(err).code === 'WAITLIST_ENTRY_NOT_FOUND') dropEntry(qc, id)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: waitlistKey })
    },
  })
}

// Terminal "this offer can't be accepted" codes. A lagging local countdown can
// produce either expiry code, and the offered slot may have vanished — all collapse
// to one "offer lapsed" outcome.
export const OFFER_LAPSED_CODES = new Set([
  'OFFER_EXPIRED',
  'OFFER_NOT_PENDING',
  'SLOT_NOT_FOUND',
  'WAITLIST_ENTRY_NOT_FOUND',
])

// Accept op fingerprint. The accept POST has no body, so the key is stable per
// entry — a double-tap or 401-refresh retry replays the same appointment.
function acceptOp(id: string): string {
  return `waitlist-accept:${id}`
}

// Accept an offered slot → creates the confirmed appointment. The idempotency-key
// header is REQUIRED by the backend, so we always mint one (same recovery as booking
// confirm if the key is ever reused against a different request).
export function useAcceptOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<BookingConfirmationView> => {
      const op = acceptOp(id)
      try {
        return await acceptOffer(id, getOrCreateKey(op))
      } catch (err) {
        if (getApiError(err).code === 'IDEMPOTENCY_KEY_REUSED') {
          clearKey(op)
          return await acceptOffer(id, getOrCreateKey(op))
        }
        throw err
      }
    },
    onSuccess: (_data, id) => {
      clearKey(acceptOp(id))
      // Remove the accepted entry from the cache up front so the app-wide banner
      // doesn't flash the (now-booked) offer over the success screen while the
      // refetch is in flight. Then reconcile against the server.
      dropEntry(qc, id)
      void qc.invalidateQueries({ queryKey: waitlistKey })
      void qc.invalidateQueries({ queryKey: appointmentsKey })
    },
    onError: (err, id) => {
      // A lapsed offer's stored key maps to nothing reusable — retire it so a future
      // re-offer of the same entry mints a fresh one, and refresh the now-stale list.
      if (OFFER_LAPSED_CODES.has(getApiError(err).code)) {
        clearKey(acceptOp(id))
        void qc.invalidateQueries({ queryKey: waitlistKey })
      }
    },
  })
}
