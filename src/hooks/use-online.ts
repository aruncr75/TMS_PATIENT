import { useEffect, useState } from 'react'

// Tracks browser connectivity via the `online`/`offline` window events. Note that
// `navigator.onLine === true` only means "a network interface exists", not "the
// server is reachable" — good enough to drive the offline banner and staleness hints.
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return online
}
