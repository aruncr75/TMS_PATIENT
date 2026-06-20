import { api } from '@/lib/api/client'
import type {
  DeviceRegistration,
  NotificationPreference,
  RegisterDeviceInput,
} from '@/types/api'

// Notifications API (Phase 7): device-token registration + push consent. All routes
// are authenticated (global JwtAuthGuard), so they use the `api` instance
// (Bearer + 401 → refresh → retry). Device registration is idempotent by token
// server-side, so no idempotency-key header is needed.

// ── Register device ─────────────────────────────────────────────────────────────
// POST /me/devices `{ token, platform? }` → `{ id }`. Re-registering the same token
// reactivates it for the current owner, so a silent re-register on app start is safe.
export async function registerDevice(input: RegisterDeviceInput): Promise<DeviceRegistration> {
  const { data } = await api.post<DeviceRegistration>('/me/devices', input)
  return data
}

// ── Unregister device ───────────────────────────────────────────────────────────
// DELETE /me/devices/:token (the raw FCM token) → 204. Soft-revoke; safe/idempotent
// even if the token is unknown or already disabled. The token can contain ':' so it
// must be percent-encoded for the path segment.
export async function unregisterDevice(token: string): Promise<void> {
  await api.delete(`/me/devices/${encodeURIComponent(token)}`)
}

// ── Notification preferences ────────────────────────────────────────────────────
// PATCH /me/notification-preferences `{ optIn }` → `{ optIn }`. Patient-only. There
// is no GET to read current consent — the caller mirrors the value locally.
export async function setNotificationPrefs(optIn: boolean): Promise<NotificationPreference> {
  const { data } = await api.patch<NotificationPreference>('/me/notification-preferences', {
    optIn,
  })
  return data
}
