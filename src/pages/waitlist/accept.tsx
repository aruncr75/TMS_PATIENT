import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  OFFER_LAPSED_CODES,
  isActiveOffer,
  useAcceptOffer,
  useWaitlist,
} from '@/hooks/use-waitlist'
import { useDoctorSlotMap } from '@/hooks/use-slots'
import { useDoctors } from '@/hooks/use-doctors'
import { getApiError } from '@/lib/api/error'
import { formatDateTime } from '@/lib/utils/date'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { HoldCountdown } from '@/components/hold-countdown'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { SlotOption } from '@/types/api'

export default function WaitlistAcceptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { show } = useToast()

  const { data: entries, isPending } = useWaitlist()
  const entry = entries?.find((e) => e.id === id)
  const { data: doctors } = useDoctors()
  const { resolveSlot } = useDoctorSlotMap(entry?.doctorId)
  const accept = useAcceptOffer()

  // Flips when the countdown reaches zero or accept returns a terminal lapse code.
  const [lapsed, setLapsed] = useState(false)

  const doctorName = doctors?.find((d) => d.id === entry?.doctorId)?.displayName
  const slot = entry?.offeredSlotId ? resolveSlot(entry.offeredSlotId) : undefined

  const handleAccept = () => {
    if (!entry) return
    accept.mutate(entry.id, {
      onSuccess: (booking) => {
        // Reuse the booking-success screen. Build a SlotOption from the resolved
        // SlotView (which uses `id`, not `slotId`) so the time renders there.
        const slotOption: SlotOption | undefined = slot
          ? { slotId: slot.id, doctorId: slot.doctorId, startAt: slot.startAt, endAt: slot.endAt }
          : undefined
        navigate('/book/success', { replace: true, state: { booking, slot: slotOption } })
      },
      onError: (err) => {
        const code = getApiError(err).code
        if (OFFER_LAPSED_CODES.has(code)) {
          setLapsed(true)
        } else {
          show(getApiError(err).message, 'error')
        }
      },
    })
  }

  // Treat a missing/non-offer entry the same as an explicit lapse once data is loaded.
  const showLapsed = lapsed || (!isPending && (!entry || !isActiveOffer(entry)))

  return (
    <div>
      <PageHeader title="Accept slot" />
      <div className="space-y-5 p-4">
        {isPending && !entry ? (
          <Skeleton className="h-56 w-full" />
        ) : showLapsed ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-semibold text-gray-900">This offer has lapsed</p>
            <p className="mt-1 text-sm text-gray-500">
              The slot was offered to the next person in line. You're still on the waitlist for any
              future openings.
            </p>
            <Button
              fullWidth
              className="mt-5"
              onClick={() => navigate('/waitlist', { replace: true })}
            >
              Back to waitlist
            </Button>
          </div>
        ) : (
          entry && (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-base font-semibold text-gray-900">{doctorName ?? 'Doctor'}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {slot ? formatDateTime(slot.startAt) : 'Offered slot'}
                </p>
                {entry.offerExpiresAt && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <HoldCountdown
                      expiresAt={entry.offerExpiresAt}
                      label="Offer expires in"
                      onExpire={() => setLapsed(true)}
                    />
                  </div>
                )}
              </div>

              <Button fullWidth loading={accept.isPending} onClick={handleAccept}>
                Accept this slot
              </Button>
              <p className="text-center text-xs text-gray-400">
                Accepting books this appointment immediately.
              </p>
            </>
          )
        )}
      </div>
    </div>
  )
}
