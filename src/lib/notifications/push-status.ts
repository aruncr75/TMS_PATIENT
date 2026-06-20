import { useSyncExternalStore } from 'react'

// A tiny module-level store for "is web push the active offer-delivery path?".
// `use-notifications` sets it true once a device token is registered (permission
// granted + opted in); `use-waitlist` reads it to decide whether to keep the 30 s
// poll alive (off when push is active, on otherwise — the fallback for denied /
// unsupported / iOS-not-installed / no-Firebase-config). Kept outside React so a
// generic hook can read it without a provider wrapper.

let pushActive = false
const listeners = new Set<() => void>()

export function setPushActive(value: boolean): void {
  if (pushActive === value) return
  pushActive = value
  listeners.forEach((l) => l())
}

function getSnapshot(): boolean {
  return pushActive
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePushActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
