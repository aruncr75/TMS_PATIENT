import { useEffect, useRef, useState } from 'react'

interface HoldCountdownProps {
  /** UTC ISO instant when the hold expires. */
  expiresAt: string
  /** Called exactly once when the countdown reaches zero. */
  onExpire: () => void
  /** Caption shown beside the timer. Defaults to the booking-hold wording. */
  label?: string
}

function remainingMs(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now())
}

// TTL bar shown while confirming a held slot. Ticks every second and fires
// `onExpire` once at zero. Re-arms when `expiresAt` changes (e.g. after the user
// picks an alternative and the slot is re-held).
export function HoldCountdown({ expiresAt, onExpire, label = 'Slot held for' }: HoldCountdownProps) {
  const [remaining, setRemaining] = useState(() => remainingMs(expiresAt))
  const totalRef = useRef(remainingMs(expiresAt))
  const firedRef = useRef(false)
  // Keep the latest onExpire without re-arming the interval each render.
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    totalRef.current = remainingMs(expiresAt)
    firedRef.current = false
    setRemaining(remainingMs(expiresAt))

    const id = setInterval(() => {
      const r = remainingMs(expiresAt)
      setRemaining(r)
      if (r <= 0 && !firedRef.current) {
        firedRef.current = true
        clearInterval(id)
        onExpireRef.current()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const sec = Math.ceil(remaining / 1000)
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  const pct = totalRef.current > 0 ? Math.max(0, (remaining / totalRef.current) * 100) : 0
  const low = remaining <= 30_000

  return (
    <div className="flex flex-col gap-1.5" role="timer" aria-live="off">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span
          className={`font-semibold tabular-nums ${low ? 'text-status-cancelled' : 'text-brand-700'}`}
        >
          {mm}:{ss}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            low ? 'bg-status-cancelled' : 'bg-brand-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
