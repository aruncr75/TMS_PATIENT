import { Link } from 'react-router-dom'
import { formatDateTime } from '@/lib/utils/date'
import { StatusBadge } from '@/components/status-badge'
import type { AppointmentView, SlotView } from '@/types/api'

interface AppointmentCardProps {
  appointment: AppointmentView
  /** Resolved slot (from useResolvedSlots); undefined → time outside the window. */
  slot?: SlotView
  doctorName?: string
}

// Shared summary card linking to the appointment detail. Time is resolved from the
// slot map; an unresolved slot degrades to "Time unavailable" without breaking.
export function AppointmentCard({ appointment, slot, doctorName }: AppointmentCardProps) {
  return (
    <Link
      to={`/appointments/${appointment.id}`}
      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-gray-900">{doctorName ?? 'Doctor'}</p>
          <StatusBadge status={appointment.status} />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {slot ? formatDateTime(slot.startAt) : 'Time unavailable'}
        </p>
      </div>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 shrink-0 text-gray-400"
        aria-hidden
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  )
}
