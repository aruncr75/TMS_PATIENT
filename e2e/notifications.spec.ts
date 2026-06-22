import { randomUUID } from 'node:crypto'
import { expect, test } from './support/fixtures'
import { patientContext } from './support/api'

// Notification settings UI. Real FCM token registration (to Google) is out of scope
// for deterministic E2E, so we assert the settings surface renders and resolves to a
// stable control/message rather than driving the browser push subscription.

test('notification settings render and resolve to a stable state', async ({ page }) => {
  await page.goto('/notifications')

  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await expect(page.getByText('Push notifications')).toBeVisible()
  await expect(page.getByText(/queue, and waitlist-offer alerts/i)).toBeVisible()

  // Leaves the "Checking availability…" state for either a toggle or a reason message.
  await expect(
    page.getByText(
      /Turn on notifications|Turn off notifications|aren.t available|aren.t configured|Install the app/,
    ),
  ).toBeVisible({ timeout: 15_000 })
})

// The push-toggle UI can't be driven deterministically (the Workbox SW is disabled
// under vite dev and FCM registration hits Google), so the three endpoints the toggle
// would call are covered here directly against the real backend — the same contract
// the client uses in src/lib/api/notifications.ts.
test('registers a device, toggles consent, and unregisters (device + prefs endpoints)', async () => {
  const ctx = await patientContext()
  try {
    const token = `e2e-fcm-${randomUUID()}:apns` // FCM tokens can contain ':'

    // POST /me/devices → 201 { id }
    const reg = await ctx.post('/me/devices', { data: { token, platform: 'web' } })
    expect(reg.status()).toBe(201)
    expect(((await reg.json()) as { id: string }).id).toBeTruthy()

    // PATCH /me/notification-preferences → echoes the opt-in both ways.
    const optIn = await ctx.patch('/me/notification-preferences', { data: { optIn: true } })
    expect(optIn.ok()).toBeTruthy()
    expect(((await optIn.json()) as { optIn: boolean }).optIn).toBe(true)

    const optOut = await ctx.patch('/me/notification-preferences', { data: { optIn: false } })
    expect(((await optOut.json()) as { optIn: boolean }).optIn).toBe(false)

    // DELETE /me/devices/:token → 204 (token percent-encoded for the path segment).
    const del = await ctx.delete(`/me/devices/${encodeURIComponent(token)}`)
    expect(del.status()).toBe(204)
  } finally {
    await ctx.dispose()
  }
})
