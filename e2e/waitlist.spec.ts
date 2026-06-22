import { type APIRequestContext } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { nextWeekendDate, patientContext, seededDoctorId } from './support/api'
import { patientProfileId } from './support/auth'
import { arrangeWaitlistOffer, clearWaitlist, joinWaitlistApi } from './support/waitlist'

// Waitlist: join a fully-booked day (a weekend has zero slots → no bookable seat →
// the join card appears) and accept a real promotion offer.

let ctx: APIRequestContext
let doctorId: string

test.beforeAll(async () => {
  ctx = await patientContext()
  doctorId = await seededDoctorId(ctx)
})

test.afterAll(async () => {
  await ctx?.dispose()
})

test('joins the waitlist for a fully-booked day', async ({ page }) => {
  const weekend = nextWeekendDate()

  await page.goto(`/book/${doctorId}/slots`)
  await page.locator('#booking-date').fill(weekend)

  // No openings → the waitlist join card replaces the slot grid.
  await expect(page.getByText('No openings for this day')).toBeVisible()
  await page.getByRole('button', { name: 'Join waitlist' }).click()

  await expect(page).toHaveURL(/\/waitlist$/)
  await expect(page.getByText('Dr. Dev').first()).toBeVisible()
  await expect(page.getByText('Waiting').first()).toBeVisible()
})

test('accepts an offered slot from the waitlist', async ({ page }) => {
  // Drive the REAL promotion pipeline: a waiting entry + a freed seat → an offer.
  const offer = await arrangeWaitlistOffer(ctx)

  await page.goto('/waitlist')
  await expect(page.getByText('Slot offered').first()).toBeVisible()

  // Accept the offer (navigate by id to avoid ambiguity if several cards are live).
  await page.goto(`/waitlist/${offer.entryId}/accept`)
  await page.getByRole('button', { name: 'Accept this slot' }).click()

  // Reuses the booking-success screen.
  await expect(page.getByText("You're booked")).toBeVisible()
})

test('leaves the waitlist (DELETE /waitlist/:id)', async ({ page }) => {
  // Make our arranged entry the SOLE live card so the Leave button is unambiguous.
  await clearWaitlist(await patientProfileId())
  await joinWaitlistApi(ctx, doctorId, nextWeekendDate())

  await page.goto('/waitlist')
  await expect(page.getByText('Waiting').first()).toBeVisible()

  await page.getByRole('button', { name: 'Leave waitlist' }).click()

  // Entry dropped from the cache → the empty state replaces the card.
  await expect(page.getByText("You're not on any waitlists")).toBeVisible()
})
