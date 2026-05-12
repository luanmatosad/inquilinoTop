import { test as base } from 'playwright-bdd'
import * as fs from 'fs'
import * as path from 'path'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080'

function readApiToken(): string {
  const tokenPath = path.resolve('e2e-bdd/.auth/api-token.json')
  const { token } = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'))
  return token
}

export const test = base.extend<{
  logado: void
  apiToken: string
  apiUrl: string
}>({
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
  apiToken: async ({}, use) => {
    await use(readApiToken())
  },
  apiUrl: async ({}, use) => {
    await use(API_URL)
  },
})

export { expect } from '@playwright/test'
