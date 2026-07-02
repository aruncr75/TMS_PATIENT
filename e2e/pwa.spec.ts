import { expect, test } from './support/fixtures'

test.describe('Progressive Web App (PWA) & Install Prompt', () => {
  test('serves PWA HTML metadata and handles Install App prompt', async ({ page }) => {
    await page.goto('/book')

    // Wait for page header to render
    await expect(page.getByRole('heading', { name: 'Choose a doctor' })).toBeVisible()

    // Check PWA HTML metadata tags
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1d4ed8')
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1.0')
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/icon-192.png')

    // Expect the floating Install App banner to be visible
    await expect(page.getByText('Install My Tokens')).toBeVisible()

    // Simulate browser dispatching `beforeinstallprompt` event
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt') as any
      event.prompt = async () => {}
      event.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(event)
    })

    // Confirm the 'Install' action button is active and clickable
    const installBtn = page.getByRole('button', { name: 'Install', exact: true })
    await expect(installBtn).toBeVisible()
    await installBtn.click()
  })
})
