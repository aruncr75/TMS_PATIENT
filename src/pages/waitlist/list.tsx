import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isActiveOffer, useLeaveWaitlist, useWaitlist } from '@/hooks/use-waitlist'
import { useDoctors } from '@/hooks/use-doctors'
import { getApiError } from '@/lib/api/error'
import { formatDateOnly } from '@/lib/utils/date'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { HoldCountdown } from '@/components/hold-countdown'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { WaitlistEntryView } from '@/types/api'

// Only waiting/offered entries are "live"; terminal ones (accepted/expired/
// cancelled) are dropped whether or not the endpoint returns them.
const LIVE_STATUSES = new Set(['waiting', 'offered'])

export default function WaitlistListPage() {
  const { data: entries, isPending, isError, refetch } = useWaitlist()
  const { data: doctors } = useDoctors()

  const doctorNames = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of doctors ?? []) m.set(d.id, d.displayName)
    return m
  }, [doctors])

  const live = useMemo(
    () => (entries ?? []).filter((e) => LIVE_STATUSES.has(e.status)),
    [entries],
  )

  return (
    <div>
      <PageHeader title="Waitlist" back={false} />
      <div className="space-y-4 p-4">
        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-status-cancelled" role="alert">
            Couldn't load your waitlist. Please try again.
          </p>
        ) : live.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-gray-900">You're not on any waitlists</p>
              <p className="mt-1 text-sm text-gray-500">
                When a day is fully booked, you can join its waitlist and we'll offer you the next
                slot that frees up.
              </p>
            </div>
            <Link
              to="/book"
              className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
            >
              Find a doctor
            </Link>
          </div>
        ) : (
          live.map((entry) => (
            <WaitlistCard
              key={entry.id}
              entry={entry}
              doctorName={doctorNames.get(entry.doctorId)}
              onChanged={() => void refetch()}
            />
          ))
        )}
      </div>
    </div>
  )
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Waiting', className: 'bg-gray-100 text-gray-600' },
  offered: { label: 'Slot offered', className: 'bg-status-confirmed/10 text-status-confirmed' },
}

function WaitlistCard({
  entry,
  doctorName,
  onChanged,
}: {
  entry: WaitlistEntryView
  doctorName: string | undefined
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const { show } = useToast()
  const leave = useLeaveWaitlist()
  const offered = isActiveOffer(entry)
  const badge = STATUS_LABEL[entry.status] ?? STATUS_LABEL.waiting

  const handleLeave = () => {
    leave.mutate(entry.id, {
      onSuccess: () => show('Removed from the waitlist.', 'info'),
      onError: (err) => {
        // Already gone (e.g. accepted/expired in another tab) → treat as success.
        if (getApiError(err).code === 'WAITLIST_ENTRY_NOT_FOUND') {
          show('This entry was already removed.', 'info')
        } else {
          show(getApiError(err).message, 'error')
        }
      },
    })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-semibold text-gray-900">{doctorName ?? 'Doctor'}</p>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">{formatDateOnly(entry.serviceDate)}</p>

      {offered && entry.offerExpiresAt != null && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <HoldCountdown
            expiresAt={entry.offerExpiresAt}
            label="Offer expires in"
            onExpire={onChanged}
          />
          <Button fullWidth onClick={() => navigate(`/waitlist/${entry.id}/accept`)}>
            Accept slot
          </Button>
        </div>
      )}

      <div className="mt-3">
        <Button
          variant="ghost"
          fullWidth
          loading={leave.isPending && leave.variables === entry.id}
          className="text-status-cancelled hover:bg-status-cancelled/5"
          onClick={handleLeave}
        >
          Leave waitlist
        </Button>
      </div>
    </div>
  )
}
