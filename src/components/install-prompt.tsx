import { useEffect, useState } from 'react'

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
  const [showDesktopHelp, setShowDesktopHelp] = useState(false)

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {}
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

  const handleInstallClick = async () => {
    if (deferred) {
      try {
        await deferred.prompt()
        const choice = await deferred.userChoice
        if (choice.outcome === 'accepted') {
          setInstalled(true)
        }
        setDeferred(null)
      } catch {
        setShowDesktopHelp(true)
      }
    } else {
      // If beforeinstallprompt didn't fire (e.g. Brave Shields / Desktop Chrome blocking auto-event)
      setShowDesktopHelp(true)
    }
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="relative flex flex-col gap-2 rounded-2xl border border-brand-100 bg-white/95 p-3.5 shadow-lg shadow-brand-950/10 backdrop-blur-md">
        {/* Dismiss button */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-400 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          ✕
        </button>

        <div className="flex items-center justify-between gap-3 min-w-0">
          {/* Icon & Details */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 p-2 text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                <path d="M10.5 1.875a1.125 1.125 0 0 1 3 0v8.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V1.875ZM3.75 13.5a.75.75 0 0 0-.75.75v3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-3a.75.75 0 0 0-1.5 0v3a1.5 1.5 0 0 1-1.5 1.5h-12a1.5 1.5 0 0 1-1.5-1.5v-3a.75.75 0 0 0-.75-.75Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {isIos() ? 'Add to Home Screen' : 'Install My Tokens'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {isIos()
                  ? 'Tap Share ➔ Add to Home Screen'
                  : 'Faster bookings & live updates'}
              </p>
            </div>
          </div>

          {/* Action Button */}
          {!isIos() && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="shrink-0 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 hover:bg-brand-700"
            >
              Install
            </button>
          )}
        </div>

        {/* Desktop / Brave instructions fallback */}
        {showDesktopHelp && !isIos() && (
          <div className="mt-1 rounded-xl bg-brand-50 p-2.5 text-xs text-brand-900 border border-brand-200/60 animate-in fade-in duration-200">
            💡 <span className="font-semibold">Brave / Chrome Desktop:</span> Click the <span className="font-bold">Install icon (📥/➕)</span> in your browser URL address bar (top right) or open <span className="font-semibold">Brave Menu ➔ Install app</span>.
          </div>
        )}
      </div>
    </div>
  )
}
