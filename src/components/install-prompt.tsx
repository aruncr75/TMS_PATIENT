import { useEffect, useState } from 'react'

// Add-to-Home-Screen helper (Phase 7). Android/desktop Chrome fire
// `beforeinstallprompt`, which we capture and replay from a button. iOS Safari has
// no such event — installation is manual (Share → Add to Home Screen) and is a
// prerequisite for background web push on iOS 16.4+, so we show instructions there.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

// Once dismissed, the prompt stays hidden for 7 days (per-device, localStorage — no
// PHI). Stores the dismissal time; a future visit re-shows it after the window lapses.
const DISMISS_KEY = 'install-prompt-dismissed-at'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

function isDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false
  const at = Number(localStorage.getItem(DISMISS_KEY))
  return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())
  const [dismissed, setDismissed] = useState(isDismissed)

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore storage failures — just hide for this session
    }
    setDismissed(true)
  }

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || dismissed) return null

  // iOS: manual install instructions (no programmatic prompt).
  if (isIos()) {
    return (
      <div className="relative rounded-2xl bg-white p-5 shadow-sm">
        <DismissButton onDismiss={dismiss} />
        <p className="font-medium text-gray-900">Install this app for notifications</p>
        <p className="mt-1 text-sm text-gray-500">
          On iPhone or iPad, tap the <span className="font-semibold">Share</span> button, then{' '}
          <span className="font-semibold">Add to Home Screen</span>. Open the app from your Home
          Screen to enable push notifications.
        </p>
      </div>
    )
  }

  // Android / desktop Chrome: replay the captured install prompt.
  if (deferred) {
    return (
      <div className="relative rounded-2xl bg-white p-5 shadow-sm">
        <DismissButton onDismiss={dismiss} />
        <p className="font-medium text-gray-900">Install this app</p>
        <p className="mt-1 text-sm text-gray-500">
          Add it to your home screen for a faster, full-screen experience.
        </p>
        <button
          type="button"
          onClick={async () => {
            await deferred.prompt()
            await deferred.userChoice
            setDeferred(null)
          }}
          className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Install app
        </button>
      </div>
    )
  }

  return null
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss install prompt"
      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
    >
      ✕
    </button>
  )
}
