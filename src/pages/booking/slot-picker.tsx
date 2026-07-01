import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAvailability } from '@/hooks/use-availability'
import { useHold } from '@/hooks/use-booking'
import { getApiError } from '@/lib/api/error'
import { todayInClinicTz } from '@/lib/utils/date'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { SlotGrid } from '@/components/slot-grid'
import { WaitlistJoinCard } from '@/components/waitlist-join-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { SlotOption } from '@/types/api'
import { BookingSocketProvider, useBookingSocket } from '@/lib/socket/booking-socket-provider'

function ConnectedSlotGrid({ slots, onSelect, pending }: { slots: SlotOption[], onSelect: (slot: SlotOption) => void, pending: boolean }) {
  const { isHeldByOthers, status } = useBookingSocket()
  
  const heldSlotIds = new Set<string>()
  for (const slot of slots) {
    if (isHeldByOthers(slot.slotId)) {
      heldSlotIds.add(slot.slotId)
    }
  }

  return (
    <div data-socket-status={status}>
      <SlotGrid slots={slots} onSelect={onSelect} pending={pending} heldSlotIds={heldSlotIds} />
    </div>
  )
}

export default function SlotPickerPage() {
  const { doctorId } = useParams<{ doctorId: string }>()
  const navigate = useNavigate()
  const { show } = useToast()

  const today = todayInClinicTz()
  const [date, setDate] = useState(today)

  const { data: slots, isPending, isError, isFetching } = useAvailability(doctorId, date)
  const hold = useHold()

  const handleSelect = (slot: SlotOption) => {
    if (!doctorId) return
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
            onChange={(e) => setDate(e.target.value)}
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
