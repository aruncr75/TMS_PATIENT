import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppointment } from '@/hooks/use-appointment'
import { useAvailability } from '@/hooks/use-availability'
import { useDoctorSlotMap } from '@/hooks/use-slots'
import { useHold } from '@/hooks/use-booking'
import { useReschedule } from '@/hooks/use-reschedule'
import { canReschedule, RESCHEDULE_LIMIT } from '@/lib/appointments'
import { getApiError } from '@/lib/api/error'
import { formatDateTime, todayInClinicTz } from '@/lib/utils/date'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { SlotGrid } from '@/components/slot-grid'
import { HoldCountdown } from '@/components/hold-countdown'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { HoldResult, SlotOption } from '@/types/api'

export default function ReschedulePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { show } = useToast()

  const { data: appt, isPending } = useAppointment(id)
  const { resolveSlot } = useDoctorSlotMap(appt?.doctorId)

  const today = todayInClinicTz()
  const [date, setDate] = useState(today)
  const [hold, setHold] = useState<HoldResult | null>(null)
  const [slot, setSlot] = useState<SlotOption | null>(null)
  const [alternatives, setAlternatives] = useState<SlotOption[] | null>(null)

  const { data: slots, isPending: slotsPending, isError, isFetching } = useAvailability(
    appt?.doctorId,
    date,
  )
  const holdM = useHold()
  const reschedule = useReschedule()

  const busy = holdM.isPending || reschedule.isPending

  const onHoldError = (err: unknown) => {
    const apiErr = getApiError(err)
    show(
      apiErr.code === 'HOLD_CAP_EXCEEDED'
        ? 'You have too many slots on hold — confirm one or wait a few minutes.'
        : apiErr.code === 'SLOT_FULL'
          ? 'That slot just filled up. Pick another.'
          : apiErr.code === 'SLOT_HELD'
            ? 'That slot is temporarily held. Pick another or try again shortly.'
            : apiErr.message,
      'error',
    )
  }

  const handleSelect = (s: SlotOption) => {
    holdM.mutate(s.slotId, {
      onSuccess: (h) => {
        setHold(h)
        setSlot(s)
        setAlternatives(null)
      },
      onError: onHoldError,
    })
  }

  const handleExpire = () => {
    setHold(null)
    setSlot(null)
    setAlternatives(null)
    show('Your hold expired. Please pick a slot again.', 'info')
  }

  const handleConfirm = () => {
    if (!id || !hold || !slot) return
    reschedule.mutate(
      { id, newSlotId: slot.slotId, holdId: hold.holdId },
      {
        onSuccess: (view) => {
          show('Appointment rescheduled.', 'success')
          navigate(`/appointments/${view.id}`, { replace: true })
        },
        onError: (err) => {
          const apiErr = getApiError(err)
          if (apiErr.code === 'SLOT_UNAVAILABLE') {
            setAlternatives(apiErr.details?.alternatives ?? [])
            show('That slot was just taken. Pick an alternative below.', 'error')
          } else if (apiErr.code === 'RESCHEDULE_TO_SAME_SLOT') {
            show('That is already your appointment time. Pick a different slot.', 'error')
          } else {
            // RESCHEDULE_LIMIT_REACHED, RESCHEDULE_OVERLAP, ILLEGAL_TRANSITION, …
            show(apiErr.message, 'error')
          }
        },
      },
    )
  }

  if (isPending) {
    return (
      <div>
        <PageHeader title="Reschedule" />
        <div className="p-4">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!appt) {
    return (
      <div>
        <PageHeader title="Reschedule" />
        <p className="p-4 py-8 text-center text-sm text-status-cancelled" role="alert">
          Couldn't load this appointment.
        </p>
      </div>
    )
  }

  // Blocked states: wrong FSM state, or limit reached.
  const blocked = !canReschedule(appt.status)
    ? 'This appointment can no longer be rescheduled.'
    : appt.rescheduleCount >= RESCHEDULE_LIMIT
      ? `You've reached the reschedule limit (${RESCHEDULE_LIMIT}) for this appointment.`
      : null

  const currentSlot = resolveSlot(appt.slotId)

  return (
    <div>
      <PageHeader title="Reschedule" />
      <div className="space-y-5 p-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Current time</p>
          <p className="mt-0.5 text-base font-semibold text-gray-900">
            {currentSlot ? formatDateTime(currentSlot.startAt) : 'Time unavailable'}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {appt.rescheduleCount} of {RESCHEDULE_LIMIT} reschedules used
          </p>
        </div>

        {blocked ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {blocked}
          </div>
        ) : hold && slot ? (
          // ── Step 2: confirm the held slot ──────────────────────────────────
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">New time</p>
              <p className="mt-0.5 text-base font-semibold text-gray-900">
                {formatDateTime(slot.startAt)}
              </p>
              <div className="mt-3">
                <HoldCountdown expiresAt={hold.expiresAt} onExpire={handleExpire} />
              </div>
            </div>

            <Button fullWidth loading={reschedule.isPending} disabled={busy} onClick={handleConfirm}>
              Confirm reschedule
            </Button>
            <Button
              variant="ghost"
              fullWidth
              disabled={busy}
              onClick={() => {
                setHold(null)
                setSlot(null)
                setAlternatives(null)
              }}
            >
              Pick a different time
            </Button>

            {alternatives && (
              <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled/5 p-4">
                <p className="text-sm font-semibold text-gray-900">
                  That slot is gone — try one of these:
                </p>
                <div className="mt-3">
                  <SlotGrid
                    slots={alternatives}
                    onSelect={handleSelect}
                    pending={holdM.isPending}
                    emptyLabel="No alternatives right now. Pick another day below."
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          // ── Step 1: pick a new slot ────────────────────────────────────────
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reschedule-date" className="text-sm font-medium text-gray-700">
                New date
              </label>
              <input
                id="reschedule-date"
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
              />
            </div>

            {slotsPending ? (
              <Skeleton className="h-40 w-full" />
            ) : isError ? (
              <p className="py-8 text-center text-sm text-status-cancelled" role="alert">
                Couldn't load availability. Please try again.
              </p>
            ) : (
              <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <SlotGrid slots={slots ?? []} onSelect={handleSelect} pending={holdM.isPending} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
