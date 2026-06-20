import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { isPushSupported, onForegroundMessage } from '@/lib/fcm'
import { registerForPush, unregisterForPush } from '@/lib/notifications/registration'
import { setPushActive, usePushActive } from '@/lib/notifications/push-status'
import { describeNotification, type NotificationData } from '@/lib/notifications/message-map'
import { setNotificationPrefs } from '@/lib/api/notifications'

// Local mirror of the push opt-in choice. The backend exposes no GET for
// notification preferences, so we remember the user's intent client-side: it gates
// the silent re-register on app start (only re-register if they previously opted in).
const OPT_IN_KEY = 'notif:optIn'

function readOptInPref(): boolean | null {
  const v = localStorage.getItem(OPT_IN_KEY)
  return v === null ? null : v === 'true'
}

function writeOptInPref(value: boolean): void {
  localStorage.setItem(OPT_IN_KEY, String(value))
}

function currentPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  return Notification.permission
}

// App-start wiring, mounted once in the authenticated shell. Sets up the foreground
// message handler and silently refreshes a (possibly rotated) FCM token when the
// user has already opted in. No-op when push is unsupported/unconfigured.
export function useNotificationsBootstrap(): void {
  const qc = useQueryClient()
  const { show } = useToast()

  useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}

    void (async () => {
      if (!(await isPushSupported())) return
      if (cancelled) return

      unsubscribe = onForegroundMessage((payload) => {
        const data = (payload.data ?? {}) as NotificationData
        const copy = describeNotification(data)
        if (!copy) return
        show(copy.body, copy.urgent ? 'success' : 'info')
        copy.invalidate.forEach((queryKey) => {
          void qc.invalidateQueries({ queryKey })
        })
      })

      if (currentPermission() === 'granted' && readOptInPref() === true) {
        const token = await registerForPush({ prompt: false })
        if (!cancelled) setPushActive(Boolean(token))
      }
    })()

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [qc, show])
}

export interface NotificationSettings {
  /** null while the async capability check is in flight. */
  supported: boolean | null
  permission: NotificationPermission
  /** True when push is the active delivery path on this device. */
  enabled: boolean
  busy: boolean
  enable: () => Promise<void>
  disable: () => Promise<void>
}

// Drives the settings page: capability/permission state + opt-in/opt-out actions.
export function useNotificationSettings(): NotificationSettings {
  const { show } = useToast()
  const pushActive = usePushActive()
  const [supported, setSupported] = useState<boolean | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>(currentPermission)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void isPushSupported().then(setSupported)
  }, [])

  const enable = useCallback(async () => {
    setBusy(true)
    try {
      const token = await registerForPush({ prompt: true })
      setPermission(currentPermission())
      if (!token) {
        setPushActive(false)
        show(
          currentPermission() === 'denied'
            ? 'Notifications are blocked — enable them in your browser settings.'
            : "Couldn't turn on notifications.",
          'error',
        )
        return
      }
      // Consent write is best-effort: the device is registered regardless.
      try {
        await setNotificationPrefs(true)
      } catch {
        // ignore
      }
      writeOptInPref(true)
      setPushActive(true)
      show('Notifications turned on', 'success')
    } finally {
      setBusy(false)
    }
  }, [show])

  const disable = useCallback(async () => {
    setBusy(true)
    try {
      try {
        await setNotificationPrefs(false)
      } catch {
        // ignore
      }
      await unregisterForPush()
      writeOptInPref(false)
      setPushActive(false)
      setPermission(currentPermission())
      show('Notifications turned off', 'info')
    } finally {
      setBusy(false)
    }
  }, [show])

  return {
    supported,
    permission,
    enabled: supported === true && permission === 'granted' && pushActive,
    busy,
    enable,
    disable,
  }
}
