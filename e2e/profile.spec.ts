import { type APIRequestContext } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { patientContext } from './support/api'

// Account self-service: read the profile (GET /me/profile), rename it
// (PATCH /me/profile), and sign out (POST /auth/logout). All three were wired in the
// client but had no e2e — driven here through the real Profile tab UI.

let ctx: APIRequestContext

test.beforeAll(async () => {
  ctx = await patientContext()
})

test.afterAll(async () => {
  await ctx?.dispose()
})

test('shows the patient profile (GET /me/profile)', async ({ page }) => {
  // Read the truth from the API, then assert the UI renders it.
  const profile = (await (await ctx.get('/me/profile')).json()) as { phone: string }

  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await expect(page.getByText(profile.phone)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
})

test('edits the display name (PATCH /me/profile)', async ({ page }) => {
  const newName = `E2E QA ${Date.now()}`

  await page.goto('/profile')
  await page.getByRole('link', { name: 'Edit profile' }).click()
  await expect(page).toHaveURL(/\/profile\/edit$/)

  // Client-side validation: an empty name never hits the backend.
  await page.getByLabel('Full name').fill('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Name is required.')).toBeVisible()

  // A real rename → PATCH → optimistic cache update → back on the profile view.
  await page.getByLabel('Full name').fill(newName)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByText(newName)).toBeVisible()
})

test('logs out from the profile tab (POST /auth/logout)', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Log out' }).click()

  // Session revoked → bounced to the public login screen.
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Send code' })).toBeVisible()
})
