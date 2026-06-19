import type { AppointmentStatus } from '@/types/api'

// FSM state → label + colour. Class strings are LITERAL (not built dynamically):
// Tailwind v4 only emits classes it can see verbatim in source, so a computed
// `bg-status-${s}` would silently vanish at build.
const STATUS_STYLES: Record<AppointmentStatus, { label: string; className: string }> = {
  requested: { label: 'Requested', className: 'bg-gray-100 text-gray-600' },
  confirmed: { label: 'Confirmed', className: 'bg-status-confirmed/10 text-status-confirmed' },
  checked_in: { label: 'Checked in', className: 'bg-status-checked-in/10 text-status-checked-in' },
  in_progress: {
    label: 'In progress',
    className: 'bg-status-in-progress/10 text-status-in-progress',
  },
  completed: { label: 'Completed', className: 'bg-status-completed/10 text-status-completed' },
  cancelled: { label: 'Cancelled', className: 'bg-status-cancelled/10 text-status-cancelled' },
  no_show: { label: 'No-show', className: 'bg-status-no-show/10 text-status-no-show' },
  rescheduled: {
    label: 'Rescheduled',
    className: 'bg-status-rescheduled/10 text-status-rescheduled',
  },
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { label, className } = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
