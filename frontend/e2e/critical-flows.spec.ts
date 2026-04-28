import { test, expect } from '@playwright/test'

test.describe('Critical Business Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[name="email"]', 'owner@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('should create a property', async ({ page }) => {
    // Navigate to properties
    await page.goto('/properties')

    // Click create button
    await page.click('button:has-text("New Property")')

    // Fill property form
    await page.fill('input[name="name"]', 'Test Property')
    await page.fill('textarea[name="description"]', 'A test property')
    await page.selectOption('select[name="type"]', 'RESIDENTIAL')

    // Submit
    await page.click('button[type="submit"]')

    // Verify redirect to property detail
    await page.waitForURL(/\/properties\/[a-f0-9-]+$/)
    expect(page.url()).toMatch(/\/properties\/[a-f0-9-]+$/)
  })

  test('should create a lease', async ({ page }) => {
    // Navigate to leases
    await page.goto('/leases')

    // Click create button
    await page.click('button:has-text("New Lease")')

    // Fill lease form
    await page.selectOption('select[name="propertyId"]', { index: 1 })
    await page.selectOption('select[name="unitId"]', { index: 1 })
    await page.selectOption('select[name="tenantId"]', { index: 1 })
    await page.fill('input[name="startDate"]', '2026-01-01')
    await page.fill('input[name="rentAmount"]', '2000')
    await page.fill('input[name="paymentDay"]', '1')

    // Submit
    await page.click('button[type="submit"]')

    // Verify lease was created
    await page.waitForURL(/\/leases\/[a-f0-9-]+$/)
    expect(page.url()).toMatch(/\/leases\/[a-f0-9-]+$/)
  })

  test('should record a payment', async ({ page }) => {
    // Navigate to payments
    await page.goto('/payments')

    // Click create button
    await page.click('button:has-text("New Payment")')

    // Fill payment form
    await page.selectOption('select[name="leaseId"]', { index: 1 })
    await page.fill('input[name="amount"]', '2000')
    await page.fill('input[name="dueDate"]', '2026-02-01')
    await page.selectOption('select[name="type"]', 'RENT')

    // Submit
    await page.click('button[type="submit"]')

    // Verify payment was recorded
    await page.waitForSelector('text=Payment recorded successfully')
    expect(page.url()).toContain('/payments')
  })

  test('should view financial dashboard', async ({ page }) => {
    // Navigate to financial dashboard
    await page.goto('/financeiro/dashboard')

    // Verify page loaded with expected elements
    await page.waitForSelector('text=Financial Dashboard', { timeout: 5000 })
    expect(page.url()).toContain('/financeiro/dashboard')

    // Verify key metrics are present
    const totalReceived = page.locator('text=Total Received')
    const pendingPayments = page.locator('text=Pending Payments')

    await expect(totalReceived).toBeVisible()
    await expect(pendingPayments).toBeVisible()
  })
})
