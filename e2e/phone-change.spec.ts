import { expect, test as base } from '@playwright/test'
import { test } from './support/fixtures'
import { createRunPatient, mintRefreshToken } from './support/auth'
import { injectOtp, uniquePhone } from './support/otp'

// OTP-gated phone change (§14.6). The happy path is driven through the REAL UI by
// planting a known code in Redis (support/otp.ts) — the same seam the suite uses for
// auth via direct DB writes. The wrong-code path needs no seam (a random backend hash
// never matches), so it runs against the live backend like auth.spec's verify test.

// Happy path uses an ISOLATED patient, never the shared run patient: mintRefreshToken
// (used by every authed fixture) resolves identity by phone, so changing the run
// patient's number mid-suite would break later tests.
base('changes the phone number via OTP (happy path)', async ({ page }) => {
  const oldPhone = await createRunPatient()
  const refreshToken = await mintRefreshToken(oldPhone)
  await page.addInitScript((rt) => localStorage.setItem('refresh_token', rt), refreshToken)

  // Stub ONLY the request: backend/.env carries live Twilio creds, so a real send to a
  // test number throws. The CONFIRM still hits the backend and validates our planted code.
  await page.route('**/auth/patient/phone-change/request', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'sent' }) }),
  )

  const newPhone = uniquePhone()

  await page.goto('/profile/phone')
  await page.getByLabel('New phone number').fill(newPhone)
  await page.getByRole('button', { name: 'Send code' }).click()

  // Advanced to the code step → plant the code for the NEW number, then verify via UI.
  await expect(page.getByLabel('Digit 1')).toBeVisible()
  await injectOtp('phone_change', newPhone, '000000')
  await page.getByLabel('Digit 1').click()
  await page.keyboard.type('000000')

  // Confirmed → back on the profile, showing the new number (profile cache invalidated).
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByText(newPhone)).toBeVisible()
})

test('rejects a wrong phone-change code', async ({ page }) => {
  const newPhone = uniquePhone()

  // Stub the request (live Twilio creds in .env). No injection → the confirm reads a
  // missing/non-matching code → AUTH_OTP_INVALID, exactly the path under test.
  await page.route('**/auth/patient/phone-change/request', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'sent' }) }),
  )

  await page.goto('/profile/phone')
  await page.getByLabel('New phone number').fill(newPhone)
  await page.getByRole('button', { name: 'Send code' }).click()

  await expect(page.getByLabel('Digit 1')).toBeVisible()
  // No injection → the backend's random hash never matches → 401 AUTH_OTP_INVALID.
  await page.getByLabel('Digit 1').click()
  await page.keyboard.type('123456')

  await expect(page.getByText(/invalid or expired/i)).toBeVisible()
  await expect(page).toHaveURL(/\/profile\/phone$/) // surfaced inline, no redirect
})
