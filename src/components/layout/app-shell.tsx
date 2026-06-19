import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/layout/bottom-nav'

// Authenticated layout: page content (with bottom padding so the fixed tab bar
// never overlaps it) plus the persistent bottom-tab nav.
export function AppShell() {
  return (
    <div className="min-h-screen bg-brand-50">
      <div className="mx-auto max-w-md pb-24">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
