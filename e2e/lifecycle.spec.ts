import { type APIRequestContext } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { bookFirstOpenSlot, patientContext, seededDoctorId } from './support/api'

// Appointment lifecycle: cancel + reschedule. Each test arranges a fresh confirmed
// appointment via the REST API (fast, isolated) then drives the UI.

let ctx: APIRequestContext
let doctorId: string

test.beforeAll(async () => {
  ctx = await patientContext()
  doctorId = await seededDoctorId(ctx)
})

test.afterAll(async () => {
  await ctx?.dispose()
})

test('cancels a confirmed appointment (no fee outside the window)', async ({ page }) => {
  const appt = await bookFirstOpenSlot(ctx, doctorId)

  await page.goto(`/appointments/${appt.appointmentId}/cancel`)
  await page.getByRole('button', { name: 'Cancel this appointment' }).click()

  // A first-open slot is days out → outside the 24h fee window → no fee.
  await expect(page.getByText(/No cancellation fee/i)).toBeVisible()
  // The status badge flips to Cancelled (exact match — avoids the toast/body copy).
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()
})

test('reschedules a confirmed appointment to a new slot', async ({ page }) => {
  const appt = await bookFirstOpenSlot(ctx, doctorId)

  await page.goto(`/appointments/${appt.appointmentId}/reschedule`)
  // Same day still has other open slots (our held one is excluded from availability).
  await page.locator('#reschedule-date').fill(appt.date)
  // Wait for that day's availability to load before reading the grid (avoids racing
  // the refetch triggered by changing the date).
  await page
    .waitForResponse(
      (r) => r.url().includes('/availability') && r.url().includes(`date=${appt.date}`) && r.ok(),
      { timeout: 20_000 },
    )
    .catch(() => {})
  const newSlot = page.locator('button[aria-pressed="false"]').first()
  await expect(newSlot).toBeVisible({ timeout: 20_000 })
  await newSlot.click()

  await page.getByRole('button', { name: 'Confirm reschedule' }).click()

  // Lands on the new appointment's detail; reschedule count advanced to 1.
  await expect(page.getByText('Appointment rescheduled.')).toBeVisible()
  await expect(page.getByText('Reschedules used')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Appointment' })).toBeVisible()
})
