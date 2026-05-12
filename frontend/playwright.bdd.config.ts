import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

const testDir = defineBddConfig({
  features: 'e2e-bdd/features/**/*.feature',
  steps: ['e2e-bdd/steps/**/*.steps.ts', 'e2e-bdd/fixtures.ts'],
})

export default defineConfig({
  testDir,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  globalSetup: './e2e-bdd/global-setup.ts',
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/bdd-results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    storageState: 'e2e-bdd/.auth/user.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
