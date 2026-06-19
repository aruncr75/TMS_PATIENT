import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rescheduleAppointment } from '@/lib/api/lifecycle'
import { clearKey, getOrCreateKey } from '@/lib/idempotency'
import { getApiError } from '@/lib/api/error'
import { appointmentKey } from '@/hooks/use-appointment'
import { appointmentsKey } from '@/hooks/use-appointments'
import type { RescheduleView } from '@/types/api'

export interface RescheduleVars {
  id: string
  newSlotId: string
  holdId: string
}

// Reschedule op fingerprint: stable per (appointment, target slot). The holdId is
// not encoded — re-holding the same slot (after a lost race or expiry) reuses this
// op but changes the request body, so the IDEMPOTENCY_KEY_REUSED recovery below
// mints a fresh key and retries once, mirroring useConfirmBooking.
function rescheduleOp(id: string, newSlotId: string): string {
  return `reschedule:${id}:${newSlotId}`
}

export function useReschedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, newSlotId, holdId }: RescheduleVars): Promise<RescheduleView> => {
      const op = rescheduleOp(id, newSlotId)
      try {
        return await rescheduleAppointment(id, { newSlotId, holdId }, getOrCreateKey(op))
      } catch (err) {
        if (getApiError(err).code === 'IDEMPOTENCY_KEY_REUSED') {
          clearKey(op)
          return await rescheduleAppointment(id, { newSlotId, holdId }, getOrCreateKey(op))
        }
        throw err
      }
    },
    onSuccess: (data, { id, newSlotId }) => {
      clearKey(rescheduleOp(id, newSlotId))
      // The old appointment is now `rescheduled`; the new one (data.id) is confirmed.
      void qc.invalidateQueries({ queryKey: appointmentsKey })
      void qc.invalidateQueries({ queryKey: appointmentKey(id) })
      void qc.invalidateQueries({ queryKey: appointmentKey(data.id) })
      // A slot was consumed/released — refresh availability and slot maps.
      void qc.invalidateQueries({ queryKey: ['availability'] })
      void qc.invalidateQueries({ queryKey: ['slots'] })
    },
  })
}
