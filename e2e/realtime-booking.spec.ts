import { type APIRequestContext } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { findOpenSlotDay, patientContext, seededDoctorId, staffContext } from './support/api'
import { mintRefreshToken, storageStateFor } from './support/auth'

let ctx: APIRequestContext
let doctorId: string
let openDate: string

test.beforeAll(async () => {
  ctx = await patientContext()
  doctorId = await seededDoctorId(ctx)
  openDate = (await findOpenSlotDay(ctx, doctorId)).date
})

test.afterAll(async () => {
  await ctx?.dispose()
})

test('real-time slot locking blocks concurrent bookings and unholds on expiry', async ({ page, browser }) => {
  page.on('console', msg => console.log('Page A:', msg.text()))
  page.on('pageerror', err => console.log('Page A Error:', err.message))

  // 1. Temporarily reduce hold TTL to 2 seconds for this test
  const adminCtx = await staffContext()
  const configRes = await adminCtx.get('/admin/clinic-config')
  const originalConfig = await configRes.json()
  await adminCtx.put('/admin/clinic-config', { data: { ...originalConfig, holdTtlSeconds: 2 } })
  await adminCtx.dispose()

  try {
    // User A (default page)
    await page.goto('/')
    await page.getByRole('link', { name: 'Book an appointment' }).click()
    await page.getByRole('button', { name: /Dr\. Dev/ }).click()
    await page.locator('#booking-date').fill(openDate)

    // Wait for User A socket to be live
    await expect(page.locator('[data-socket-status="live"]')).toBeVisible()

    // Find the first available slot
    const slotA = page.locator('button[aria-pressed="false"]:not([disabled])').first()
    await expect(slotA).toBeVisible()
    const slotTime = await slotA.textContent()

    // Set up User B (second browser context)
    const tokenB = await mintRefreshToken()
    const contextB = await browser.newContext({ storageState: storageStateFor(tokenB) })
    const pageB = await contextB.newPage()
    
    pageB.on('console', msg => console.log('Page B:', msg.text()))
    pageB.on('pageerror', err => console.log('Page B Error:', err.message))

    await pageB.goto('/')
    await pageB.getByRole('link', { name: 'Book an appointment' }).click()
    await pageB.getByRole('button', { name: /Dr\. Dev/ }).click()
    await pageB.locator('#booking-date').fill(openDate)

    // Wait for User B socket to be live
    await expect(pageB.locator('[data-socket-status="live"]')).toBeVisible()

    // User B sees the slot as available initially
    const slotB = pageB.getByRole('button', { name: slotTime! })
    await expect(slotB).toBeVisible()
    await expect(slotB).toBeEnabled()

    // User A clicks the slot (holds it)
    await slotA.click()

    // User B should immediately see the slot become disabled and locked (amber)
    // No page refresh is needed.
    await expect(slotB).toBeDisabled()
    await expect(slotB).toHaveClass(/border-amber-400/)
    
    // The lock icon should be visible for User B
    const lockIcon = slotB.locator('svg')
    await expect(lockIcon).toBeVisible()

    // 4. Wait for TTL to expire (2 seconds + margin)
    // User B should see the slot become enabled and available again
    await expect(slotB).toBeEnabled({ timeout: 10000 })
    await expect(slotB).not.toHaveClass(/border-amber-400/)

    // Cleanup context
    await contextB.close()
  } finally {
    // 5. Restore original config
    const adminCtxRestore = await staffContext()
    await adminCtxRestore.put('/admin/clinic-config', { data: originalConfig })
    await adminCtxRestore.dispose()
  }
})

test('going back from confirm page immediately releases the hold', async ({ page }) => {
  // Use default TTL for this test (or whatever is standard)
  await page.goto('/')
  await page.getByRole('link', { name: 'Book an appointment' }).click()
  await page.getByRole('button', { name: /Dr\. Dev/ }).click()
  await page.locator('#booking-date').fill(openDate)

  await expect(page.locator('[data-socket-status="live"]')).toBeVisible()

  // Find an available slot and click it
  const slot = page.locator('button[aria-pressed="false"]:not([disabled])').first()
  await expect(slot).toBeVisible()
  const slotTime = await slot.textContent()

  await slot.click()
  
  // We should be on the confirm page
  await expect(page.getByRole('heading', { name: 'Confirm booking' })).toBeVisible()

  // Press back using the app's back button
  await page.getByRole('button', { name: 'Go back' }).click()

  // We should be on the picker page again
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible()
  await expect(page.locator('[data-socket-status="live"]')).toBeVisible()

  // The exact slot we held should be COMPLETELY FREE (not an active hold, not locked)
  const sameSlot = page.getByRole('button', { name: slotTime! })
  await expect(sameSlot).toBeVisible()
  await expect(sameSlot).toBeEnabled()
  await expect(sameSlot).not.toHaveClass(/border-amber-400/)

  // Clicking it again should safely take us back to confirm
  await sameSlot.click()
  await expect(page.getByRole('heading', { name: 'Confirm booking' })).toBeVisible()
})

test('hopping between slots correctly releases previous holds', async ({ page, browser }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Book an appointment' }).click()
  await page.getByRole('button', { name: /Dr\. Dev/ }).click()
  await page.locator('#booking-date').fill(openDate)
  await expect(page.locator('[data-socket-status="live"]')).toBeVisible()

  // Find two available slots
  const slots = page.locator('button[aria-pressed="false"]:not([disabled])')
  await expect(slots.nth(1)).toBeVisible()
  const slot1 = slots.nth(0)
  const slot2 = slots.nth(1)
  const slot1Time = await slot1.textContent()
  const slot2Time = await slot2.textContent()

  // 1. Select Slot 1
  await slot1.click()
  await expect(page.getByRole('heading', { name: 'Confirm booking' })).toBeVisible()

  // 2. Go back
  await page.getByRole('button', { name: 'Go back' }).click()
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible()
  await expect(page.locator('[data-socket-status="live"]')).toBeVisible()

  // 3. Select Slot 2
  await page.getByRole('button', { name: slot2Time! }).click()
  await expect(page.getByRole('heading', { name: 'Confirm booking' })).toBeVisible()

  // 4. Go back again
  await page.getByRole('button', { name: 'Go back' }).click()
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible()
  await expect(page.locator('[data-socket-status="live"]')).toBeVisible()

  // 5. Verify Slot 1 is entirely free (no lock, enabled)
  const slot1Button = page.getByRole('button', { name: slot1Time! })
  await expect(slot1Button).toBeEnabled()
  await expect(slot1Button).not.toHaveClass(/border-amber-400/)

  // 6. Verify Slot 2 is our active hold (no lock, enabled)
  const slot2Button = page.getByRole('button', { name: slot2Time! })
  await expect(slot2Button).toBeEnabled()
  await expect(slot2Button).not.toHaveClass(/border-amber-400/)

  // 7. Verify on another device (User B)
  const tokenB = await mintRefreshToken()
  const contextB = await browser.newContext({ storageState: storageStateFor(tokenB) })
  const pageB = await contextB.newPage()
  await pageB.goto('/')
  await pageB.getByRole('link', { name: 'Book an appointment' }).click()
  await pageB.getByRole('button', { name: /Dr\. Dev/ }).click()
  await pageB.locator('#booking-date').fill(openDate)
  await expect(pageB.locator('[data-socket-status="live"]')).toBeVisible()

  // User B sees Slot 1 as totally free
  const bSlot1 = pageB.getByRole('button', { name: slot1Time! })
  await expect(bSlot1).toBeEnabled()
  await expect(bSlot1).not.toHaveClass(/border-amber-400/)

  // User B sees Slot 2 as totally free, because User A went back to the picker!
  const bSlot2 = pageB.getByRole('button', { name: slot2Time! })
  await expect(bSlot2).toBeEnabled()
  await expect(bSlot2).not.toHaveClass(/border-amber-400/)

  await contextB.close()

  // 8. Keep it idle then do refresh on User A
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible()
  await expect(page.locator('[data-socket-status="live"]')).toBeVisible()

  // 9. Verify Slot 2 is still totally free after refresh
  const refreshedSlot2 = page.getByRole('button', { name: slot2Time! })
  await expect(refreshedSlot2).toBeEnabled()
  await expect(refreshedSlot2).not.toHaveClass(/border-amber-400/)
})

