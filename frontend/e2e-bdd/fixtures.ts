import { test as base } from 'playwright-bdd'

export const test = base.extend<{ logado: void }>({
  logado: [
    async ({ page }, use) => {
      await page.goto('/login')
      await page.fill('input[name="email"]', 'owner@example.com')
      await page.fill('input[name="password"]', 'senha123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/')
      await use()
    },
    { auto: false },
  ],
})

export { expect } from '@playwright/test'
