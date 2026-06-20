import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/layout/bottom-nav'
import { WaitlistOfferBanner } from '@/components/waitlist-offer-banner'
import { OfflineBanner } from '@/components/offline-banner'
import { useNotificationsBootstrap } from '@/hooks/use-notifications'

// Authenticated layout: an app-wide waitlist offer banner, the page content (with
// bottom padding so the fixed tab bar never overlaps it), and the persistent
// bottom-tab nav. The banner sits above the content so an incoming offer is visible
// from any tab; it renders nothing when there's no live offer.
export function AppShell() {
  // App-start FCM wiring (Phase 7): foreground handler + silent token refresh.
  // Mounted here (not in main.tsx) so it only runs inside the authenticated area —
  // device registration hits an authenticated endpoint.
  useNotificationsBootstrap()

  return (
    <div className="min-h-screen bg-brand-50">
      <div className="mx-auto max-w-md pb-24">
        <OfflineBanner />
        <WaitlistOfferBanner />
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
