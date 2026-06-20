import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { InstallPrompt, isIos, isStandalone } from '@/components/install-prompt'
import { useNotificationSettings } from '@/hooks/use-notifications'
import { hasFirebaseConfig } from '@/lib/fcm'

export default function NotificationSettingsPage() {
  const { supported, permission, enabled, busy, enable, disable } = useNotificationSettings()

  // On iOS, web push requires the app installed to the Home Screen first.
  const iosNeedsInstall = isIos() && !isStandalone()
  const canToggle = supported === true && !iosNeedsInstall

  return (
    <div>
      <PageHeader title="Notifications" />
      <div className="space-y-4 p-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900">Push notifications</p>
              <p className="mt-1 text-sm text-gray-500">
                Get appointment, queue, and waitlist-offer alerts even when the app is closed.
              </p>
            </div>
            {enabled && (
              <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-status-confirmed">
                On
              </span>
            )}
          </div>

          {supported === null ? (
            <p className="mt-4 text-sm text-gray-400">Checking availability…</p>
          ) : supported === false ? (
            <p className="mt-4 text-sm text-gray-500">
              {hasFirebaseConfig()
                ? 'Push notifications aren’t available in this browser.'
                : 'Push notifications aren’t configured for this app yet.'}
            </p>
          ) : (
            <>
              {permission === 'denied' && (
                <p className="mt-4 text-sm text-status-cancelled">
                  Notifications are blocked. Enable them in your browser settings, then try again.
                </p>
              )}
              {iosNeedsInstall && (
                <p className="mt-4 text-sm text-gray-500">
                  Install the app to your Home Screen first (see below) to enable notifications on
                  iOS.
                </p>
              )}
              <Button
                variant={enabled ? 'secondary' : 'primary'}
                fullWidth
                loading={busy}
                disabled={!canToggle || (permission === 'denied' && !enabled)}
                onClick={enabled ? disable : enable}
                className="mt-4"
              >
                {enabled ? 'Turn off notifications' : 'Turn on notifications'}
              </Button>
            </>
          )}
        </section>

        <InstallPrompt />
      </div>
    </div>
  )
}
