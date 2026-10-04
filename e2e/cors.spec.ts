import { test, expect } from '@playwright/test'

test('frame loads without CORS taint and canvas export succeeds', async ({ page }) => {
  await page.goto(`/c/${process.env.TEST_CAMPAIGN_TOKEN}`)
  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/test-photo.jpg')
  await expect(page.locator('button:has-text("Download")')).toBeEnabled({ timeout: 5000 })

  await page.click('button:has-text("Download")')

  // If CORS is broken, the "Download failed" error appears
  await expect(page.locator('text=Download failed')).not.toBeVisible({ timeout: 4000 })
})
