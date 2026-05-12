import { chromium, request } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080'
const EMAIL = process.env.E2E_USER_EMAIL ?? 'owner@example.com'
const PASSWORD = process.env.E2E_USER_PASSWORD ?? 'senha123'
const AUTH_DIR = path.join(__dirname, '.auth')

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true })

  // 1. Obter token via Go API (usado nos steps para criar/deletar dados)
  const ctx = await request.newContext({ baseURL: API_URL })
  const loginRes = await ctx.post('/api/v1/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  })
  if (!loginRes.ok()) {
    throw new Error(`globalSetup: login falhou — ${loginRes.status()} ${await loginRes.text()}`)
  }
  const { data } = await loginRes.json()
  fs.writeFileSync(
    path.join(AUTH_DIR, 'api-token.json'),
    JSON.stringify({ token: data.access_token }),
  )
  await ctx.dispose()

  // 2. Obter storageState do browser (cookies httpOnly do Next.js auth)
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 })
  await page.context().storageState({ path: path.join(AUTH_DIR, 'user.json') })
  await browser.close()
}
