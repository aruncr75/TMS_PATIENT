import { useNavigate, useParams } from 'react-router-dom'
import { useAppointment } from '@/hooks/use-appointment'
import { useDoctorSlotMap } from '@/hooks/use-slots'
import { useDoctors } from '@/hooks/use-doctors'
import { useCheckIn } from '@/hooks/use-checkin'
import { canCheckIn } from '@/lib/appointments'
import { getApiError } from '@/lib/api/error'
import { formatDateTime } from '@/lib/utils/date'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'

// One-tap self check-in. Issues the patient's token, then sends them to the live
// queue tracker. The backend owns the real check-in window (§16.5), so a too-early /
// too-late attempt surfaces its message rather than being pre-blocked here.
export default function CheckInPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { show } = useToast()
  const { data: appt, isPending, isError } = useAppointment(id)
  const { resolveSlot } = useDoctorSlotMap(appt?.doctorId)
  const { data: doctors } = useDoctors()
  const checkIn = useCheckIn()

  const doctorName = doctors?.find((d) => d.id === appt?.doctorId)?.displayName ?? 'Doctor'
  const slot = appt ? resolveSlot(appt.slotId) : undefined

  const onCheckIn = () => {
    if (!id) return
    checkIn.mutate(id, {
      onSuccess: () => {
        show('Checked in — your token is ready.', 'success')
        navigate('/queue', { replace: true })
      },
      onError: (err) => show(getApiError(err).message, 'error'),
    })
  }

  return (
    <div>
      <PageHeader title="Check in" />
      <div className="space-y-5 p-4">
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : isError || !appt ? (
          <p className="py-8 text-center text-sm text-status-cancelled" role="alert">
            Couldn't load this appointment.
          </p>
        ) : appt.status === 'checked_in' ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-sm">
            <p className="text-sm text-gray-600">You're already checked in.</p>
            <Button fullWidth className="mt-4" onClick={() => navigate('/queue', { replace: true })}>
              View live queue
            </Button>
          </div>
        ) : !canCheckIn(appt.status) ? (
          <p className="py-8 text-center text-sm text-gray-500" role="alert">
            This appointment can't be checked in.
          </p>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-base font-semibold text-gray-900">{doctorName}</p>
              <p className="mt-1 text-sm text-gray-600">
                {slot ? formatDateTime(slot.startAt) : 'Time unavailable'}
              </p>
              <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
                Checking in issues your token number and adds you to today's queue.
              </p>
            </div>
            <Button fullWidth loading={checkIn.isPending} onClick={onCheckIn}>
              Check in now
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
