import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAvailability } from '@/hooks/use-availability'
import { useHold } from '@/hooks/use-booking'
import { getApiError } from '@/lib/api/error'
import { getActiveHold, clearActiveHold } from '@/lib/active-hold'
import { todayInClinicTz } from '@/lib/utils/date'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { SlotGrid } from '@/components/slot-grid'
import { WaitlistJoinCard } from '@/components/waitlist-join-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { SlotOption } from '@/types/api'
import { BookingSocketProvider, useBookingSocket } from '@/lib/socket/booking-socket-provider'

function ConnectedSlotGrid({ slots, onSelect, pending }: { slots: SlotOption[], onSelect: (slot: SlotOption) => void, pending: boolean }) {
  const { isHeldByOthers, getSlotState, status } = useBookingSocket()
  
  const heldSlotIds = new Set<string>()
  const visibleSlots: SlotOption[] = []

  for (const slot of slots) {
    const state = getSlotState(slot.slotId)
    // If the real-time state says it's fully booked, hide it completely
    if (state && state.bookedCount >= state.capacity) {
      continue
    }

    if (isHeldByOthers(slot.slotId)) {
      heldSlotIds.add(slot.slotId)
    }
    visibleSlots.push(slot)
  }

  return (
    <div data-socket-status={status}>
      <SlotGrid slots={visibleSlots} onSelect={onSelect} pending={pending} heldSlotIds={heldSlotIds} />
    </div>
  )
}

export default function SlotPickerPage() {
  const { doctorId } = useParams<{ doctorId: string }>()
  const navigate = useNavigate()
  const { show } = useToast()

  const today = todayInClinicTz()
  // If the user navigated back from confirm, open on the day they were looking at
  const [date, setDate] = useState(() => getActiveHold()?.clinicDate ?? today)

  const { data: slots, isPending, isError, isFetching } = useAvailability(doctorId, date)
  const hold = useHold(doctorId, date)

  // When returning to the picker grid from the confirm page (e.g. clicking Back),
  // instantly release any lingering hold so the slot frees up for others.
  // We do this on mount of the picker rather than unmount of the confirm page
  // to avoid React 18 StrictMode instantly releasing holds before confirmation.
  useEffect(() => {
    clearActiveHold()
  }, [])

  const handleSelect = (slot: SlotOption) => {
    if (!doctorId) return
    
    // If the user clicks a DIFFERENT slot, release their current hold first
    // to prevent hoarding slots and locking themselves out.
    const current = getActiveHold()
    if (current && current.slotId !== slot.slotId) {
      clearActiveHold()
    }

    hold.mutate(slot.slotId, {
      onSuccess: (holdResult) => {
        navigate(`/book/${doctorId}/confirm`, { state: { hold: holdResult, slot } })
      },
      onError: (err) => {
        const apiErr = getApiError(err)
        show(
          apiErr.code === 'HOLD_CAP_EXCEEDED'
            ? 'You have too many slots on hold — confirm one or wait a few minutes.'
            : apiErr.code === 'SLOT_FULL'
              ? 'That slot just filled up. Pick another.'
              : apiErr.message,
          'error',
        )
      },
    })
  }

  return (
    <div>
      <PageHeader title="Pick a time" />
      <div className="space-y-5 p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="booking-date" className="text-sm font-medium text-gray-700">
            Date
          </label>
          <input
            id="booking-date"
            type="date"
            value={date}
            min={today}
            onChange={(e) => {
              clearActiveHold()
              setDate(e.target.value)
            }}
            className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
          />
        </div>

        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : isError ? (
          <p className="py-8 text-center text-sm text-status-cancelled" role="alert">
            Couldn't load availability. Please try again.
          </p>
        ) : (slots?.length ?? 0) === 0 && doctorId ? (
          // Fully booked day → offer the waitlist instead of an empty grid.
          <WaitlistJoinCard doctorId={doctorId} date={date} />
        ) : doctorId ? (
          <BookingSocketProvider doctorId={doctorId} date={date}>
            <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <ConnectedSlotGrid slots={slots ?? []} onSelect={handleSelect} pending={hold.isPending} />
            </div>
          </BookingSocketProvider>
        ) : null}
      </div>
    </div>
  )
}
