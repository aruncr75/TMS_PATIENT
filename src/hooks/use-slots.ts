import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { getDoctorSlots } from '@/lib/api/appointments'
import { todayInClinicTz } from '@/lib/utils/date'
import type { AppointmentView, SlotView } from '@/types/api'

// AppointmentView has no time field — only `slotId`. We resolve display times by
// matching slotId against a doctor's SlotView[]. The /slots endpoint defaults to
// today-only, so we fetch a bounded clinic-local window per doctor; any slot
// outside it degrades to a "Time unavailable" label (grouping stays status-driven).
const PAST_WINDOW_DAYS = 60
const FUTURE_WINDOW_DAYS = 90

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function slotWindow(): { from: string; to: string } {
  const today = todayInClinicTz()
  return { from: shiftYmd(today, -PAST_WINDOW_DAYS), to: shiftYmd(today, FUTURE_WINDOW_DAYS) }
}

function toSlotMap(slots: SlotView[] | undefined): Map<string, SlotView> {
  const map = new Map<string, SlotView>()
  for (const slot of slots ?? []) map.set(slot.id, slot)
  return map
}

// Single doctor's windowed slots as a `slotId → SlotView` map. Used by the detail
// and reschedule screens, which already know the appointment's doctorId.
export function useDoctorSlotMap(doctorId: string | undefined) {
  const window = useMemo(slotWindow, [])
  const query = useQuery({
    queryKey: ['slots', doctorId, window.from, window.to] as const,
    queryFn: () => getDoctorSlots(doctorId as string, window),
    enabled: Boolean(doctorId),
    staleTime: 5 * 60_000,
  })
  const slotMap = useMemo(() => toSlotMap(query.data), [query.data])
  return { ...query, slotMap, resolveSlot: (slotId: string) => slotMap.get(slotId) }
}

// Resolve times across a list of appointments that may span multiple doctors:
// one windowed slots query per distinct doctorId, merged into one map.
export function useResolvedSlots(appointments: AppointmentView[] | undefined) {
  const window = useMemo(slotWindow, [])
  const doctorIds = useMemo(
    () => Array.from(new Set((appointments ?? []).map((a) => a.doctorId))),
    [appointments],
  )
  return useQueries({
    queries: doctorIds.map((doctorId) => ({
      queryKey: ['slots', doctorId, window.from, window.to] as const,
      queryFn: () => getDoctorSlots(doctorId, window),
      staleTime: 5 * 60_000,
    })),
    combine: (results) => {
      const slotMap = new Map<string, SlotView>()
      for (const r of results) {
        for (const slot of r.data ?? []) slotMap.set(slot.id, slot)
      }
      return {
        slotMap,
        isPending: results.some((r) => r.isPending),
        resolveSlot: (slotId: string) => slotMap.get(slotId),
      }
    },
  })
}
