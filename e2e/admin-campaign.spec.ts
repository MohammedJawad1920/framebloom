import { test, expect } from '@playwright/test'

test('admin creates campaign and uploads a frame', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', process.env.TEST_ADMIN_EMAIL!)
  await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD!)
  await page.click('button[type="submit"]:has-text("Sign in")')
  await page.waitForURL('/dashboard')

  await page.click('text=New campaign')
  await page.waitForURL(/\/campaigns\//)

  // Upload a test frame PNG
  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/test-frame.png')
  await expect(page.locator('text=test-frame')).toBeVisible({ timeout: 10_000 })
})
