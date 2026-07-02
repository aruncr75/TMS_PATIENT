import type { AppointmentStatus } from '@/types/api'

// FSM state → label + colour. Class strings are LITERAL (not built dynamically):
// Tailwind v4 only emits classes it can see verbatim in source, so a computed
// `bg-status-${s}` would silently vanish at build.
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
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
  waiting: { label: 'Waiting', className: 'bg-amber-50 text-amber-700' },
  promoted: { label: 'Promoted', className: 'bg-emerald-50 text-emerald-700' },
  offered: { label: 'Offered', className: 'bg-blue-50 text-blue-700' },
  expired: { label: 'Expired', className: 'bg-gray-100 text-gray-500' },
}

function formatFallback(raw?: string): string {
  if (!raw) return 'Unknown'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StatusBadge({ status }: { status?: AppointmentStatus | string | null }) {
  const key = (status ?? '').toLowerCase()
  const style = STATUS_STYLES[key] ?? {
    label: formatFallback(status ?? undefined),
    className: 'bg-gray-100 text-gray-600',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  )
}
