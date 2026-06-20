import {
  deleteCurrentToken,
  getCurrentToken,
  getExistingToken,
  requestPermissionAndToken,
} from '@/lib/fcm'
import { registerDevice, unregisterDevice } from '@/lib/api/notifications'

// Bridges the FCM web SDK (token lifecycle) and the backend device registry. Plain
// async functions (not hooks) so both the settings hook and the logout flow in
// auth-context can reuse them.

// Obtain an FCM token and register it with the backend. `prompt: true` is the user
// opt-in path (may show the permission dialog); `prompt: false` is the silent
// app-start refresh (only runs if permission is already granted). Returns the token
// on success, or null when push is unavailable / denied / registration failed.
export async function registerForPush({ prompt }: { prompt: boolean }): Promise<string | null> {
  const token = prompt ? await requestPermissionAndToken() : await getExistingToken()
  if (!token) return null
  try {
    await registerDevice({ token, platform: 'web' })
  } catch {
    return null
  }
  return token
}

// Revoke this device: drop it from the backend registry (needs the bearer token, so
// the caller must run this BEFORE clearing auth) then delete the local FCM token.
// Best-effort throughout — failures never block logout or opt-out.
export async function unregisterForPush(): Promise<void> {
  const token = getCurrentToken()
  if (token) {
    try {
      await unregisterDevice(token)
    } catch {
      // best-effort
    }
  }
  await deleteCurrentToken()
}
