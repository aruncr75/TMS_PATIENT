import { type APIRequestContext } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { patientContext } from './support/api'

// Dependents CRUD (no delete endpoint exists): add a dependent through the form
// (POST /me/dependents), then rename one (PATCH /me/dependents/:id). The list page
// reads GET /me/dependents. The "edit" arrange uses the API to obtain a stable id,
// then the UI drives the actual mutation — the suite's arrange-via-REST pattern.

let ctx: APIRequestContext

test.beforeAll(async () => {
  ctx = await patientContext()
})

test.afterAll(async () => {
  await ctx?.dispose()
})

test('adds a dependent through the form (POST /me/dependents)', async ({ page }) => {
  const name = `Dep Add ${Date.now()}`

  await page.goto('/profile/dependents')
  await page.getByRole('link', { name: 'Add dependent' }).click()
  await expect(page).toHaveURL(/\/profile\/dependents\/add$/)

  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Relationship').selectOption('Child')
  await page.getByRole('button', { name: 'Add dependent' }).click()

  // Redirected back to the list, where the new dependent now appears (cache invalidated).
  await expect(page).toHaveURL(/\/profile\/dependents$/)
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
})

test('edits an existing dependent (PATCH /me/dependents/:id)', async ({ page }) => {
  const orig = `Dep Edit ${Date.now()}`
  const res = await ctx.post('/me/dependents', { data: { fullName: orig } })
  expect(res.ok()).toBeTruthy()
  const { id } = (await res.json()) as { id: string }
  const newName = `${orig} Renamed`

  await page.goto(`/profile/dependents/${id}/edit`)
  // The edit form prefilled from GET /me/dependents → proves the read path.
  const nameInput = page.getByLabel('Full name')
  await expect(nameInput).toHaveValue(orig)

  await nameInput.fill(newName)
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page).toHaveURL(/\/profile\/dependents$/)
  await expect(page.getByRole('listitem').filter({ hasText: newName })).toBeVisible()
})
