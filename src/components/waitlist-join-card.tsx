import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useJoinWaitlist } from '@/hooks/use-waitlist'
import { getApiError } from '@/lib/api/error'
import { formatDateOnly } from '@/lib/utils/date'
import { useToast } from '@/components/ui/toast'
import { DependentPicker } from '@/components/dependent-picker'
import { Button } from '@/components/ui/button'

interface WaitlistJoinCardProps {
  doctorId: string
  /** Clinic-local YYYY-MM-DD the patient is trying to book. */
  date: string
}

// Shown in the slot-picker when a day is fully booked. The dependent + consultation
// type chosen here are frozen onto the waitlist entry and flow straight through to the
// appointment that accept eventually creates — there's no second chance to set them, so
// they're captured up front (mirrors the booking-confirm step).
export function WaitlistJoinCard({ doctorId, date }: WaitlistJoinCardProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { show } = useToast()
  const join = useJoinWaitlist()
  const typeId = useId()

  const [dependentId, setDependentId] = useState<string | null>(null)
  const [consultationType, setConsultationType] = useState<'free' | 'paid'>('free')

  const handleJoin = () => {
    join.mutate(
      {
        doctorId,
        input: { date, dependentId: dependentId ?? undefined, consultationType },
      },
      {
        onSuccess: () => {
          show("Added to the waitlist — we'll offer you the next opening.", 'success')
          navigate('/waitlist')
        },
        onError: (err) => {
          const code = getApiError(err).code
          if (code === 'SLOT_AVAILABLE_USE_BOOKING') {
            // A slot freed up between the empty result and the join — refetch so the
            // grid reappears and the patient books directly.
            show('A slot just opened up — pick a time above.', 'info')
            void qc.invalidateQueries({ queryKey: ['availability'] })
          } else if (code === 'ALREADY_WAITLISTED') {
            show("You're already on the waitlist for this day.", 'info')
            navigate('/waitlist')
          } else {
            show(getApiError(err).message, 'error')
          }
        },
      },
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-base font-semibold text-gray-900">No openings for this day</p>
      <p className="mt-1 text-sm text-gray-500">
        Join the waitlist for {formatDateOnly(date)} — if a slot opens up, we'll offer it to you.
      </p>

      <div className="mt-4 space-y-4">
        <DependentPicker
          value={dependentId}
          onChange={setDependentId}
          label="Waitlist for"
          disabled={join.isPending}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={typeId} className="text-sm font-medium text-gray-700">
            Consultation
          </label>
          <select
            id={typeId}
            value={consultationType}
            onChange={(e) => setConsultationType(e.target.value as 'free' | 'paid')}
            disabled={join.isPending}
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-60"
          >
            <option value="free">Free</option>
            <option value="paid" disabled>
              Paid (coming soon)
            </option>
          </select>
        </div>

        <Button fullWidth loading={join.isPending} onClick={handleJoin}>
          Join waitlist
        </Button>
      </div>
    </div>
  )
}
