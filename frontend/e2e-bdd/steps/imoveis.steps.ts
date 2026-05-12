// frontend/e2e-bdd/steps/imoveis.steps.ts
import { createBdd } from 'playwright-bdd'
import { test, expect } from '../fixtures'
import { PropertiesPage } from '../pages/PropertiesPage'

const { Given, When, Then, After, Before } = createBdd(test)

let propertiesPage: PropertiesPage

Before(async ({ page }) => {
  propertiesPage = new PropertiesPage(page)
})
const createdPropertyIds: string[] = []

Given('que estou autenticado', async ({ page }) => {
  await page.goto('/')
  await expect(page).not.toHaveURL(/\/login/)
})

Given(
  'que existe um imóvel {string} do tipo {string} criado via API',
  async ({ request, apiToken, apiUrl }, nome: string, tipo: string) => {
    const res = await request.post(`${apiUrl}/api/v1/properties`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: nome, type: tipo },
    })
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    createdPropertyIds.push(data.id)
  },
)

When('navego para a lista de imóveis', async ({}) => {
  await propertiesPage.navegarParaLista()
})

When('clico no link de novo imóvel', async ({}) => {
  await propertiesPage.clicarNovoImovel()
})

When('preencho o nome do imóvel com {string}', async ({}, nome: string) => {
  await propertiesPage.preencherNome(nome)
})

When('seleciono o tipo {string}', async ({}, tipo: string) => {
  await propertiesPage.selecionarTipo(tipo as 'SINGLE' | 'RESIDENTIAL')
})

When('submeto o formulário de imóvel', async ({}) => {
  await propertiesPage.submeterFormulario()
})

When('submeto o formulário de imóvel sem preencher o nome', async ({}) => {
  await propertiesPage.submeterFormularioSemNome()
})

When('navego para a página do imóvel {string}', async ({}, nome: string) => {
  await propertiesPage.navegarParaImovel(nome)
})

When('excluo o imóvel', async ({}) => {
  await propertiesPage.excluirImovel()
})

Then('devo ver {string} na lista', async ({}, nome: string) => {
  await propertiesPage.verificarNaLista(nome)
})

Then('devo ver a confirmação de imóvel criado', async ({}) => {
  await propertiesPage.verificarToastCriado()
})

Then('devo ser redirecionado para a página do imóvel', async ({ page }) => {
  await propertiesPage.verificarRedirecionadoParaImovel()
  // capture ID from URL for cleanup
  const match = page.url().match(/\/properties\/([a-f0-9-]+)/)
  if (match) createdPropertyIds.push(match[1])
})

Then('o formulário não deve ser submetido', async ({}) => {
  await propertiesPage.verificarFormularioNaoSubmetido()
})

Then('devo ser redirecionado para a lista de imóveis', async ({ page }) => {
  await page.waitForURL(/\/properties$/)
})

Then('{string} não deve aparecer na lista', async ({}, nome: string) => {
  await propertiesPage.verificarAusenteNaLista(nome)
})

After(async ({ request, apiToken, apiUrl }) => {
  for (const id of createdPropertyIds) {
    await request.delete(`${apiUrl}/api/v1/properties/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  createdPropertyIds.length = 0
})
