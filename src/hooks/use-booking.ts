import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmBooking, holdSlot, type ConfirmBookingInput } from '@/lib/api/booking'
import { clearKey, getOrCreateKey } from '@/lib/idempotency'
import { getApiError } from '@/lib/api/error'
import type { BookingConfirmationView } from '@/types/api'
import { setActiveHold, clearActiveHold } from '@/lib/active-hold'
import { useAuth } from '@/lib/auth/auth-context'

// Hold a slot (Phase 3). Holding never enforces scarcity and never returns
// alternatives — that happens at confirm. Mutations don't auto-retry (the global
// retry config only covers queries), so a 429/HOLD_CAP_EXCEEDED surfaces to the
// caller to message.
export function useHold(doctorId?: string, clinicDate?: string) {
  const { patientId } = useAuth()
  return useMutation({
    mutationFn: (slotId: string) => holdSlot(slotId),
    onSuccess: (holdResult) => {
      if (doctorId && clinicDate) {
        setActiveHold({ ...holdResult, doctorId, clinicDate, patientId })
      }
    }
  })
}

// Idempotency-key op fingerprint. The backend dedup hash =
// {slotId, dependentId, consultationType, reasonForVisit}; we encode the non-PHI
// fields into the storage-key op so the key is payload-deterministic, stays stable
// across transparent retries (401-refresh reuses the same header → no double-book),
// and changes when the slot/dependent/type changes. reasonForVisit (PHI) is handled
// by the IDEMPOTENCY_KEY_REUSED recovery below, never stored in a key.
function confirmOp(input: ConfirmBookingInput): string {
  const type = input.consultationType ?? 'free'
  return `book-confirm:${input.slotId}:${input.dependentId ?? 'self'}:${type}`
}

export function useConfirmBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ConfirmBookingInput): Promise<BookingConfirmationView> => {
      const op = confirmOp(input)
      try {
        return await confirmBooking(input, getOrCreateKey(op))
      } catch (err) {
        // Same key, different request hash (e.g. the user edited reasonForVisit
        // between attempts, which the op fingerprint can't see) → mint a fresh key
        // and retry once.
        if (getApiError(err).code === 'IDEMPOTENCY_KEY_REUSED') {
          clearKey(op)
          return await confirmBooking(input, getOrCreateKey(op))
        }
        throw err
      }
    },
    onSuccess: (_data, input) => {
      // Confirmed success: retire the key so a later identical booking gets a new one.
      clearKey(confirmOp(input))
      // Clear the active hold now that it's consumed
      clearActiveHold()
      // Keep Phase 4's appointment list fresh.
      void qc.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}
