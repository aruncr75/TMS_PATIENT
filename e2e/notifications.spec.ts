import { expect, test } from './support/fixtures'

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
