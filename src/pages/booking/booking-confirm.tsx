import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useConfirmBooking, useHold } from '@/hooks/use-booking'
import { getApiError } from '@/lib/api/error'
import { formatDateTime } from '@/lib/utils/date'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { DependentPicker } from '@/components/dependent-picker'
import { HoldCountdown } from '@/components/hold-countdown'
import { SlotGrid } from '@/components/slot-grid'
import { Button } from '@/components/ui/button'
import type { HoldResult, SlotOption } from '@/types/api'

interface ConfirmNavState {
  hold?: HoldResult
  slot?: SlotOption
}

export default function BookingConfirmPage() {
  const { doctorId } = useParams<{ doctorId: string }>()
  const navigate = useNavigate()
  const { show } = useToast()
  const location = useLocation()
  const navState = (location.state ?? null) as ConfirmNavState | null

  // Hold + slot are seeded from route state and replaced in place when the user
  // picks an alternative after a lost race. There is no GET-hold endpoint, so a
  // browser refresh wipes this — handled by the guard below.
  const [hold, setHold] = useState<HoldResult | null>(navState?.hold ?? null)
  const [slot, setSlot] = useState<SlotOption | null>(navState?.slot ?? null)

  // Form state lives here so it survives the inline re-render after a lost race.
  const [dependentId, setDependentId] = useState<string | null>(null)
  const [consultationType, setConsultationType] = useState<'free' | 'paid'>('free')
  const [reasonForVisit, setReasonForVisit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [alternatives, setAlternatives] = useState<SlotOption[] | null>(null)

  const confirm = useConfirmBooking()
  const rehold = useHold()

  // Guard: no hold (e.g. a refresh on this route) → back to the slot picker.
  useEffect(() => {
    if (!hold) {
      show('Your hold has expired. Please pick a slot again.', 'info')
      navigate(`/book/${doctorId}/slots`, { replace: true })
    }
    // Run once on mount; `hold` only ever transitions to a new hold afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!hold || !slot) return null

  const handleExpire = () => {
    show('Your hold expired. Please pick a slot again.', 'info')
    navigate(`/book/${doctorId}/slots`, { replace: true })
  }

  const handleConfirm = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    confirm.mutate(
      {
        slotId: slot.slotId,
        holdId: hold.holdId,
        dependentId: dependentId ?? undefined,
        consultationType,
        reasonForVisit: reasonForVisit.trim() || undefined,
      },
      {
        onSuccess: (booking) => {
          navigate('/book/success', { state: { booking, slot }, replace: true })
        },
        onError: (err) => {
          const apiErr = getApiError(err)
          if (apiErr.code === 'SLOT_UNAVAILABLE') {
            // Lost the last-slot race: offer alternatives inline. Form state stays.
            setAlternatives(apiErr.details?.alternatives ?? [])
            show('That slot was just taken. Pick an alternative below.', 'error')
          } else {
            setError(apiErr.message)
          }
        },
      },
    )
  }

  const handlePickAlternative = (alt: SlotOption) => {
    rehold.mutate(alt.slotId, {
      onSuccess: (newHold) => {
        setHold(newHold)
        setSlot(alt)
        setAlternatives(null)
        setError(null)
      },
      onError: (err) => {
        const apiErr = getApiError(err)
        show(
          apiErr.code === 'HOLD_CAP_EXCEEDED'
            ? 'You have too many slots on hold — confirm one or wait a few minutes.'
            : apiErr.message,
          'error',
        )
      },
    })
  }

  const busy = confirm.isPending || rehold.isPending

  return (
    <div>
      <PageHeader title="Confirm booking" />
      <div className="space-y-5 p-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Selected time</p>
          <p className="mt-0.5 text-base font-semibold text-gray-900">
            {formatDateTime(slot.startAt)}
          </p>
          <div className="mt-3">
            <HoldCountdown expiresAt={hold.expiresAt} onExpire={handleExpire} />
          </div>
        </div>

        <form onSubmit={handleConfirm} className="flex flex-col gap-5" noValidate>
          <DependentPicker value={dependentId} onChange={setDependentId} disabled={busy} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="consultation-type" className="text-sm font-medium text-gray-700">
              Consultation type
            </label>
            <select
              id="consultation-type"
              value={consultationType}
              onChange={(e) => setConsultationType(e.target.value as 'free' | 'paid')}
              disabled={busy}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-60"
            >
              <option value="free">Free</option>
              <option value="paid" disabled>
                Paid (coming soon)
              </option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason" className="text-sm font-medium text-gray-700">
              Reason for visit (optional)
            </label>
            <textarea
              id="reason"
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={busy}
              className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-60"
              placeholder="Briefly describe your symptoms"
            />
          </div>

          {error && (
            <p className="text-sm text-status-cancelled" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth loading={confirm.isPending} disabled={busy}>
            Confirm booking
          </Button>
        </form>

        {alternatives && (
          <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled/5 p-4">
            <p className="text-sm font-semibold text-gray-900">That slot is gone — try one of these:</p>
            <div className="mt-3">
              <SlotGrid
                slots={alternatives}
                onSelect={handlePickAlternative}
                pending={rehold.isPending}
                emptyLabel="No alternatives right now. Go back and pick another day."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
