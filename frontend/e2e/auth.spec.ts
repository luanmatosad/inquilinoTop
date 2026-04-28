import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login')

    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')

    // Submit form
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('/')
    expect(page.url()).toBe('http://localhost:3000/')
  })

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login')

    // Fill with wrong credentials
    await page.fill('input[name="email"]', 'wrong@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')

    // Submit form
    await page.click('button[type="submit"]')

    // Should stay on login page
    await page.waitForSelector('text=Invalid credentials', { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test('should logout successfully', async ({ page }) => {
    // Assume already logged in
    await page.goto('/')

    // Find and click logout button
    await page.click('button[aria-label="Logout"]')

    // Should redirect to login
    await page.waitForURL('/login')
    expect(page.url()).toContain('/login')
  })
})
