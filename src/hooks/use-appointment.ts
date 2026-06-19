import { useQuery } from '@tanstack/react-query'
import { getAppointment } from '@/lib/api/appointments'

export const appointmentKey = (id: string) => ['appointment', id] as const

// A single appointment (PHI-gated read). Used by the detail, cancel and
// reschedule screens.
export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: appointmentKey(id as string),
    queryFn: () => getAppointment(id as string),
    enabled: Boolean(id),
  })
}
