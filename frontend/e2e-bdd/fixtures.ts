import { test as base } from 'playwright-bdd'
import * as fs from 'fs'
import * as path from 'path'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080'

function readApiToken(): string {
  const tokenPath = path.join(__dirname, '.auth/api-token.json')
  let raw: string
  try {
    raw = fs.readFileSync(tokenPath, 'utf-8')
  } catch {
    throw new Error(
      `apiToken fixture: arquivo não encontrado em ${tokenPath}. Certifique-se de que o globalSetup foi executado.`,
    )
  }
  const { token } = JSON.parse(raw)
  return token
}

export const test = base.extend<{
  apiToken: string
  apiUrl: string
}>({
  apiToken: async ({}, use) => {
    await use(readApiToken())
  },
  apiUrl: async ({}, use) => {
    await use(API_URL)
  },
})

export { expect } from '@playwright/test'
