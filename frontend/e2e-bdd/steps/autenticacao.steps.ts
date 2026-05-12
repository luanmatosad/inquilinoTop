import { createBdd } from 'playwright-bdd'
import { test } from '../fixtures'

const { Given, When, Then } = createBdd(test)

Given('que estou na página de login', async ({ page }) => {
  await page.goto('/login')
})

When('preencho o email {string} e a senha {string}', async ({ page }, email: string, senha: string) => {
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', senha)
})

When('clico em entrar', async ({ page }) => {
  await page.click('button[type="submit"]')
})

Then('devo ser redirecionado para o dashboard', async ({ page }) => {
  await page.waitForURL('/')
})

Then('devo permanecer na página de login', async ({ page }) => {
  await page.waitForURL(/.*\/login.*/)
})

Then('devo ver a mensagem de erro {string}', async ({ page }, mensagem: string) => {
  await page.waitForSelector(`text=${mensagem}`, { timeout: 5000 })
})
