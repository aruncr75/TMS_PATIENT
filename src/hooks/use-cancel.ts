import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelAppointment } from '@/lib/api/lifecycle'
import { clearKey, getOrCreateKey } from '@/lib/idempotency'
import { appointmentKey } from '@/hooks/use-appointment'
import { appointmentsKey } from '@/hooks/use-appointments'
import type { CancellationView } from '@/types/api'

// Cancel op fingerprint. The cancel POST has no body, so the key is stable per
// appointment — a double-tap or 401-refresh retry replays the same response, and
// re-cancelling a terminal appointment is a backend no-op (200) the UI messages.
function cancelOp(id: string): string {
  return `cancel:${id}`
}

export function useCancel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<CancellationView> =>
      cancelAppointment(id, getOrCreateKey(cancelOp(id))),
    onSuccess: (_data, id) => {
      clearKey(cancelOp(id))
      void qc.invalidateQueries({ queryKey: appointmentsKey })
      void qc.invalidateQueries({ queryKey: appointmentKey(id) })
    },
  })
}
