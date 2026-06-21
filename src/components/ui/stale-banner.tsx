import type { ReactNode } from 'react'

// Inline amber "status" pill shared by the offline-appointments hint and the
// reconnecting queue tracker — keeps the two staleness messages visually and
// accessibly identical (single source for padding/colour/`role="status"`).
export function StaleBanner({ children }: { children: ReactNode }) {
  return (
    <p
      className="rounded-xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-700"
      role="status"
    >
      {children}
    </p>
  )
}
