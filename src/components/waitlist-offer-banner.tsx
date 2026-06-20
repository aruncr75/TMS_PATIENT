import { useLocation, useNavigate } from 'react-router-dom'
import { findActiveOffer, useWaitlist } from '@/hooks/use-waitlist'
import { useDoctors } from '@/hooks/use-doctors'
import { HoldCountdown } from '@/components/hold-countdown'

// App-wide offer banner (Phase 6). Driven by the shared `['waitlist']` poll, it
// surfaces the first live promotion offer on every authenticated page so it's never
// missed while the tab is open (Phase 7 replaces the poll with FCM push). Hidden
// when there's no offer and on the accept route itself (redundant there).
export function WaitlistOfferBanner() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data: entries, refetch } = useWaitlist()
  const { data: doctors } = useDoctors()

  const onAcceptRoute = /^\/waitlist\/[^/]+\/accept$/.test(pathname)
  const offer = findActiveOffer(entries)
  if (!offer || onAcceptRoute || offer.offerExpiresAt == null) return null

  const doctorName = doctors?.find((d) => d.id === offer.doctorId)?.displayName ?? 'your doctor'

  return (
    <div className="border-b border-brand-200 bg-brand-50 px-4 py-3">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-brand-800">A slot just opened up</p>
            <p className="text-xs text-brand-700">with {doctorName} — accept before it lapses</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/waitlist/${offer.id}/accept`)}
            className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Accept
          </button>
        </div>
        <HoldCountdown
          expiresAt={offer.offerExpiresAt}
          label="Offer expires in"
          // At zero, refetch so the (now-lapsed) offer drops out of `findActiveOffer`
          // and this banner unmounts.
          onExpire={() => void refetch()}
        />
      </div>
    </div>
  )
}
