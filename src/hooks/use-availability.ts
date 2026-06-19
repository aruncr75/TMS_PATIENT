import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAvailability } from '@/lib/api/booking'
import { withRetry } from '@/lib/utils/retry'

// Small debounce so rapid date changes don't fan out availability requests.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

/**
 * Bookable slots for a doctor on a clinic-local date. The date is debounced
 * 400 ms; `withRetry` backs off on 429 (the global React Query `retry` skips all
 * 4xx, so rate-limit backoff must live in the queryFn).
 */
export function useAvailability(doctorId: string | undefined, date: string) {
  const debouncedDate = useDebouncedValue(date, 400)
  return useQuery({
    queryKey: ['availability', doctorId, debouncedDate] as const,
    queryFn: () => withRetry(() => getAvailability(doctorId as string, debouncedDate)),
    enabled: Boolean(doctorId) && Boolean(debouncedDate),
  })
}
