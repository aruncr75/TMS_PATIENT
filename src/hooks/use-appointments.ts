import { useQuery } from '@tanstack/react-query'
import { listAppointments } from '@/lib/api/appointments'

export const appointmentsKey = ['appointments'] as const

// All of the patient's appointments. Mutations across the app (confirm booking,
// cancel, reschedule) invalidate `['appointments']` to keep this fresh.
export function useAppointments() {
  return useQuery({
    queryKey: appointmentsKey,
    queryFn: listAppointments,
  })
}
