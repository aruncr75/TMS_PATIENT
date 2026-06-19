import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppointment } from '@/hooks/use-appointment'
import { useCancel } from '@/hooks/use-cancel'
import { useDoctorSlotMap } from '@/hooks/use-slots'
import { getApiError } from '@/lib/api/error'
import { formatDateTime } from '@/lib/utils/date'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { CancellationView } from '@/types/api'

export default function CancelAppointmentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { show } = useToast()
  const { data: appt, isPending } = useAppointment(id)
  const { resolveSlot } = useDoctorSlotMap(appt?.doctorId)
  const cancel = useCancel()
  const [result, setResult] = useState<CancellationView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    if (!id) return
    setError(null)
    cancel.mutate(id, {
      onSuccess: (view) => {
        setResult(view)
        const charged = view.feePercent > 0 && !view.feeWaived
        show(
          charged ? `Cancelled — a ${view.feePercent}% fee applies.` : 'Appointment cancelled.',
          charged ? 'info' : 'success',
        )
      },
      onError: (err) => setError(getApiError(err).message),
    })
  }

  if (isPending) {
    return (
      <div>
        <PageHeader title="Cancel appointment" />
        <div className="p-4">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  // Already cancelled (or otherwise terminal): no-op, surface it plainly.
  const alreadyCancelled = result != null || appt?.status === 'cancelled'

  return (
    <div>
      <PageHeader title="Cancel appointment" />
      <div className="space-y-5 p-4">
        {appt && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-gray-500">Selected time</p>
              <StatusBadge status={result ? 'cancelled' : appt.status} />
            </div>
            <p className="mt-0.5 text-base font-semibold text-gray-900">
              {(() => {
                const slot = resolveSlot(appt.slotId)
                return slot ? formatDateTime(slot.startAt) : 'Time unavailable'
              })()}
            </p>
          </div>
        )}

        {alreadyCancelled ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled/5 p-4 text-sm">
              {result && result.feePercent > 0 && !result.feeWaived ? (
                <p className="font-medium text-gray-900">
                  This appointment was cancelled. A {result.feePercent}% cancellation fee applies.
                </p>
              ) : (
                <p className="font-medium text-gray-900">
                  This appointment is cancelled. No cancellation fee.
                </p>
              )}
            </div>
            <Button fullWidth onClick={() => navigate('/appointments')}>
              Back to appointments
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              A cancellation fee may apply if you're within the clinic's cancellation window. The
              exact fee is confirmed when you cancel.
            </div>

            {error && (
              <p className="text-sm text-status-cancelled" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <Button
                fullWidth
                loading={cancel.isPending}
                className="bg-status-cancelled hover:bg-status-cancelled/90 disabled:bg-status-cancelled/50"
                onClick={handleConfirm}
              >
                Cancel this appointment
              </Button>
              <Button variant="ghost" fullWidth disabled={cancel.isPending} onClick={() => navigate(-1)}>
                Keep appointment
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
