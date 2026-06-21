import { useEffect, useState } from 'react'

// Re-renders on a fixed interval so relative-time labels ("N min ago") keep
// advancing without a data change. Pass `enabled=false` to stop the timer when no
// such label is on screen. Returns the current epoch-ms to thread into
// `relativeMinutesLabel(ts, now)`.
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) return
    // Re-sync immediately on enable so the label reflects the real age right away,
    // not the value captured when the component first mounted.
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])

  return now
}
