import { expect, test as anonTest } from '@playwright/test'
import { test } from './support/fixtures'
import { injectOtp, uniquePhone } from './support/otp'

// The OTP happy-path can't be automated (the code is a one-way HMAC in Redis), so the
// authenticated session is bootstrapped via the refresh-token seam (fixtures.ts).
// Here we prove that bootstrap works, plus the login/verify UI validation + error paths.

test.describe('session bootstrap (real backend)', () => {
  test('hydrates an authenticated session from the stored refresh token', async ({ page }) => {
    await page.goto('/')
    // AuthGuard let us through and Home rendered → hydrateSession + /auth/refresh worked.
    await expect(page.getByRole('link', { name: 'Book an appointment' })).toBeVisible()
  })
})

anonTest.describe('login + verify UI (unauthenticated)', () => {
  // No stored session (base test has no token) — render the public auth screens fresh.
  const test = anonTest

  test('rejects a malformed phone number before any request', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Phone number').fill('12345')
    await page.getByRole('button', { name: 'Send code' }).click()
    await expect(page.getByText(/international format/i)).toBeVisible()
  })

  test('advances to the code screen and surfaces a wrong-code error', async ({ page }) => {
    // Stub only the OTP REQUEST so we never trigger a real SMS / hit the 3/min limit.
    await page.route('**/auth/patient/otp/request', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'sent' }),
      }),
    )

    await page.goto('/login')
    await page.getByLabel('Phone number').fill('+15555550199')
    await page.getByRole('button', { name: 'Send code' }).click()

    await expect(page.getByRole('heading', { name: 'Enter code' })).toBeVisible()

    // A wrong code is verified against the REAL backend → 401 AUTH_OTP_INVALID.
    await page.getByLabel('Digit 1').click()
    await page.keyboard.type('000000')

    await expect(page.getByText(/invalid or expired/i)).toBeVisible()
    await expect(page).toHaveURL(/\/verify$/) // surfaced inline, no redirect
  })

  test('logs in through the OTP happy path (real backend)', async ({ page }) => {
    // A fresh phone → verify AUTO-REGISTERS the patient. The code is planted in Redis
    // (one-way HMAC, can't be read back) so the real /auth/patient/otp/verify succeeds.
    const phone = uniquePhone()

    // Stub ONLY the request: backend/.env carries live Twilio creds, so a real send to a
    // test number throws. The VERIFY still hits the backend and validates our planted code.
    await page.route('**/auth/patient/otp/request', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'sent' }),
      }),
    )

    await page.goto('/login')
    await page.getByLabel('Phone number').fill(phone)
    await page.getByRole('button', { name: 'Send code' }).click()

    await expect(page.getByRole('heading', { name: 'Enter code' })).toBeVisible()
    await injectOtp('login', phone, '000000')
    await page.getByLabel('Digit 1').click()
    await page.keyboard.type('000000')

    // Authenticated session minted → AuthGuard lets us onto Home.
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: 'Book an appointment' })).toBeVisible()
  })
})
