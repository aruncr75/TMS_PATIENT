import { type APIRequestContext } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { findOpenSlotDay, patientContext, seededDoctorId } from './support/api'

// The core booking journey, end to end against real data:
// Home → choose doctor → pick a real open slot → hold → confirm → success →
// the new appointment shows in the list.

let ctx: APIRequestContext
let doctorId: string
let openDate: string

test.beforeAll(async () => {
  ctx = await patientContext()
  doctorId = await seededDoctorId(ctx)
  // Find a clinic-local date that actually has open slots (seeded Mon–Fri).
  openDate = (await findOpenSlotDay(ctx, doctorId)).date
})

test.afterAll(async () => {
  await ctx?.dispose()
})

test('books an appointment and sees it in the list', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Book an appointment' }).click()

  // Doctor directory → pick the seeded doctor.
  await page.getByRole('button', { name: /Dr\. Dev/ }).click()

  // Slot picker: choose a day that has availability, then the first open slot.
  await page.locator('#booking-date').fill(openDate)
  const firstSlot = page.locator('button[aria-pressed="false"]').first()
  await expect(firstSlot).toBeVisible()
  await firstSlot.click()

  // Confirm screen (consultation type defaults to Free).
  await page.getByRole('button', { name: 'Confirm booking' }).click()

  // Success screen.
  await expect(page.getByText("You're booked")).toBeVisible()
  await expect(page.getByText('Appointment ID')).toBeVisible()

  // The appointment shows in the list as Confirmed with the doctor's name.
  await page.getByRole('link', { name: 'View my appointments' }).click()
  await expect(page).toHaveURL(/\/appointments$/)
  await expect(page.getByText('Dr. Dev').first()).toBeVisible()
  await expect(page.getByText('Confirmed').first()).toBeVisible()
})
