import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/layout/bottom-nav'
import { WaitlistOfferBanner } from '@/components/waitlist-offer-banner'

// Authenticated layout: an app-wide waitlist offer banner, the page content (with
// bottom padding so the fixed tab bar never overlaps it), and the persistent
// bottom-tab nav. The banner sits above the content so an incoming offer is visible
// from any tab; it renders nothing when there's no live offer.
export function AppShell() {
  return (
    <div className="min-h-screen bg-brand-50">
      <div className="mx-auto max-w-md pb-24">
        <WaitlistOfferBanner />
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
