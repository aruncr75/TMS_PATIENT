import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

interface Tab {
  to: string
  label: string
  icon: ReactNode
}

// Compact 24px stroke icons (no icon dependency).
const icon = (path: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-6 w-6"
    aria-hidden
  >
    {path}
  </svg>
)

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: icon(<path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />) },
  {
    to: '/book',
    label: 'Book',
    icon: icon(
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 2.5v4M16 2.5v4M12 12.5v4M10 14.5h4" />
      </>,
    ),
  },
  {
    to: '/appointments',
    label: 'Appts',
    icon: icon(
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>,
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: icon(
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" />
      </>,
    ),
  },
]

function isActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.to)
          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                  active ? 'text-brand-700' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
