import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDoctors } from '@/hooks/use-doctors'
import { formatDateTime } from '@/lib/utils/date'
import { PageHeader } from '@/components/layout/page-header'
import type { BookingConfirmationView, SlotOption } from '@/types/api'

interface SuccessNavState {
  booking?: BookingConfirmationView
  slot?: SlotOption
}

export default function BookingSuccessPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state ?? null) as SuccessNavState | null
  const booking = navState?.booking
  const slot = navState?.slot

  const { data: doctors } = useDoctors()
  const doctor = doctors?.find((d) => d.id === booking?.doctorId)

  // Direct navigation / refresh has no booking in state → nothing to show.
  useEffect(() => {
    if (!booking) navigate('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!booking) return null

  return (
    <div>
      <PageHeader title="Booking confirmed" back={false} />
      <div className="space-y-5 p-4">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-confirmed/10">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-status-confirmed"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="mt-3 text-lg font-semibold text-gray-900">You're booked</p>
          {doctor && <p className="mt-1 text-sm text-gray-600">with {doctor.displayName}</p>}
          {slot && (
            <p className="mt-0.5 text-sm font-medium text-gray-900">{formatDateTime(slot.startAt)}</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Appointment ID</span>
            <span className="font-mono text-gray-900">{booking.id}</span>
          </div>
          <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-brand-800">
            No token yet — your token number is issued when you check in.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/appointments"
            className="block rounded-xl bg-brand-600 px-4 py-3 text-center text-base font-semibold text-white hover:bg-brand-700"
          >
            View my appointments
          </Link>
          <Link
            to="/"
            className="block rounded-xl px-4 py-3 text-center text-base font-semibold text-brand-700 hover:bg-brand-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
