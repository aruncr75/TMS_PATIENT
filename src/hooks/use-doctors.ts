import { useQuery } from '@tanstack/react-query'
import { listDoctors } from '@/lib/api/booking'

export const doctorsKey = ['doctors'] as const

// The bookable doctor directory rarely changes within a session, so keep it
// fresh for 5 minutes before revalidating.
export function useDoctors() {
  return useQuery({
    queryKey: doctorsKey,
    queryFn: listDoctors,
    staleTime: 5 * 60_000,
  })
}
