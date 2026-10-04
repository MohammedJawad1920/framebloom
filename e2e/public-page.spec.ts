import { test, expect } from '@playwright/test'

test('visitor uploads photo, download button activates', async ({ page }) => {
  await page.goto(`/c/${process.env.TEST_CAMPAIGN_TOKEN}`)
  await expect(page.locator('canvas')).toBeVisible()

  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/test-photo.jpg')
  await expect(page.locator('button:has-text("Download")')).toBeEnabled({ timeout: 5000 })

  // Click second color swatch if present
  const swatches = page.locator('button[title]')
  const count = await swatches.count()
  if (count > 1) await swatches.nth(1).click()
  await expect(page.locator('canvas')).toBeVisible()
})
