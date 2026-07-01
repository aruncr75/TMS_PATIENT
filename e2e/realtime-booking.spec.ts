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

  // User A (default page)
  await page.goto('/')
  await page.getByRole('link', { name: 'Book an appointment' }).click()
  await page.getByRole('button', { name: /Dr\. Dev/ }).click()
  await page.locator('#booking-date').fill(openDate)

  // Wait for User A socket to be live
  await expect(page.locator('[data-socket-status="live"]')).toBeVisible()

  // Find the first available slot
  const slotA = page.locator('button[aria-pressed="false"]').first()
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

  // 5. Restore original config
  const adminCtxRestore = await staffContext()
  await adminCtxRestore.put('/admin/clinic-config', { data: originalConfig })
  await adminCtxRestore.dispose()
})
