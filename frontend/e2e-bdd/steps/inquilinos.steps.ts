// frontend/e2e-bdd/steps/inquilinos.steps.ts
import { createBdd } from 'playwright-bdd'
import { test, expect } from '../fixtures'
import { TenantsPage } from '../pages/TenantsPage'

const { Given, When, Then, Before, After } = createBdd(test)

let tenantsPage: TenantsPage
const createdTenantIds: string[] = []

Before(async ({ page }) => {
  tenantsPage = new TenantsPage(page)
})

Given('que estou na página de inquilinos', async ({}) => {
  await tenantsPage.navegar()
})

Given(
  'que existe um inquilino {string} criado via API',
  async ({ request, apiToken, apiUrl }, nome: string) => {
    const res = await request.post(`${apiUrl}/api/v1/tenants`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: nome, person_type: 'PF' },
    })
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    createdTenantIds.push(data.id)
  },
)

When('clico no botão de novo inquilino', async ({}) => {
  await tenantsPage.clicarNovoInquilino()
})

When('preencho o nome do inquilino com {string}', async ({}, nome: string) => {
  await tenantsPage.preencherNome(nome)
})

When('preencho o email do inquilino com {string}', async ({}, email: string) => {
  await tenantsPage.preencherEmail(email)
})

When('submeto o formulário de inquilino', async ({}) => {
  await tenantsPage.submeterFormulario()
})

When('submeto o formulário de inquilino sem preencher o nome', async ({}) => {
  await tenantsPage.submeterSemNome()
})

When('desativo o inquilino {string}', async ({}, nome: string) => {
  await tenantsPage.desativarInquilino(nome)
})

Then('devo ver {string} na tabela de inquilinos', async ({}, nome: string) => {
  await tenantsPage.verificarNaTabela(nome)
})

Then('devo ver a confirmação de inquilino cadastrado', async ({}) => {
  await tenantsPage.verificarToastCadastrado()
})

Then('o dialog de inquilino deve permanecer aberto', async ({}) => {
  await tenantsPage.verificarDialogAberto()
})

Then('devo ver a confirmação de status alterado', async ({}) => {
  await tenantsPage.verificarToastStatusAlterado()
})

After(async ({ request, apiToken, apiUrl }) => {
  for (const id of createdTenantIds) {
    await request.delete(`${apiUrl}/api/v1/tenants/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  createdTenantIds.length = 0
})
