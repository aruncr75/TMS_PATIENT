import { useNavigate, useParams } from 'react-router-dom'
import { useAppointment } from '@/hooks/use-appointment'
import { useDoctorSlotMap } from '@/hooks/use-slots'
import { useDoctors } from '@/hooks/use-doctors'
import { canCancel, canCheckIn, canReschedule } from '@/lib/appointments'
import { formatDateTime } from '@/lib/utils/date'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: appt, isPending, isError } = useAppointment(id)
  const { resolveSlot } = useDoctorSlotMap(appt?.doctorId)
  const { data: doctors } = useDoctors()

  return (
    <div>
      <PageHeader title="Appointment" />
      <div className="space-y-5 p-4">
        {isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : isError || !appt ? (
          <p className="py-8 text-center text-sm text-status-cancelled" role="alert">
            Couldn't load this appointment.
          </p>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-gray-900">
                  {doctors?.find((d) => d.id === appt.doctorId)?.displayName ?? 'Doctor'}
                </p>
                <StatusBadge status={appt.status} />
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {(() => {
                  const slot = resolveSlot(appt.slotId)
                  return slot ? formatDateTime(slot.startAt) : 'Time unavailable'
                })()}
              </p>

              <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
                <InfoRow label="Consultation" value={titleCase(appt.consultationType)} />
                <InfoRow label="Payment" value={titleCase(appt.paymentStatus)} />
                {appt.reasonForVisit && (
                  <InfoRow label="Reason" value={appt.reasonForVisit} />
                )}
                <InfoRow label="Reschedules used" value={String(appt.rescheduleCount)} />
              </dl>
            </div>

            {(canCheckIn(appt.status) ||
              appt.status === 'checked_in' ||
              canReschedule(appt.status) ||
              canCancel(appt.status)) && (
              <div className="flex flex-col gap-3">
                {canCheckIn(appt.status) && (
                  <Button fullWidth onClick={() => navigate(`/appointments/${appt.id}/checkin`)}>
                    Check in
                  </Button>
                )}
                {appt.status === 'checked_in' && (
                  <Button fullWidth onClick={() => navigate('/queue')}>
                    View live queue
                  </Button>
                )}
                {canReschedule(appt.status) && (
                  <Button
                    variant={canCheckIn(appt.status) ? 'secondary' : 'primary'}
                    fullWidth
                    onClick={() => navigate(`/appointments/${appt.id}/reschedule`)}
                  >
                    Reschedule
                  </Button>
                )}
                {canCancel(appt.status) && (
                  <Button
                    variant="ghost"
                    fullWidth
                    className="text-status-cancelled hover:bg-status-cancelled/5"
                    onClick={() => navigate(`/appointments/${appt.id}/cancel`)}
                  >
                    Cancel appointment
                  </Button>
                )}
              </div>
            )}

            {/* Single join path: opens this doctor's availability, which offers the
                waitlist when the chosen day is fully booked. */}
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate(`/book/${appt.doctorId}/slots`)}
            >
              Book or join waitlist
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  )
}
