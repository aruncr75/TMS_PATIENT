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

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())

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

  if (installed) return null

  // iOS: manual install instructions (no programmatic prompt).
  if (isIos()) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm">
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
      <div className="rounded-2xl bg-white p-5 shadow-sm">
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
