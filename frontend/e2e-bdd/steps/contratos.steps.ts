// frontend/e2e-bdd/steps/contratos.steps.ts
import { createBdd } from 'playwright-bdd'
import { test, expect } from '../fixtures'
import { LeasesPage } from '../pages/LeasesPage'

const { Given, When, Then, Before, After } = createBdd(test)

let leasesPage: LeasesPage
let availableUnitId = ''
let availableTenantId = ''
let activeLeaseUnitId = ''

const toDelete = {
  leaseIds: [] as string[],
  tenantIds: [] as string[],
  propertyIds: [] as string[],
}

Before(async ({ page }) => {
  leasesPage = new LeasesPage(page)
})

Given('que estou na página de contratos', async ({}) => {
  await leasesPage.navegar()
})

Given('que existe um contrato ativo criado via API', async ({ request, apiToken, apiUrl }) => {
  // Create property (SINGLE auto-creates a unit)
  const propRes = await request.post(`${apiUrl}/api/v1/properties`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: { name: `Prop Contrato BDD ${Date.now()}`, type: 'SINGLE' },
  })
  expect(propRes.ok()).toBeTruthy()
  const { data: prop } = await propRes.json()
  toDelete.propertyIds.push(prop.id)

  // Get unit ID from property detail
  const detailRes = await request.get(`${apiUrl}/api/v1/properties/${prop.id}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  const { data: propDetail } = await detailRes.json()
  const unitId: string = propDetail.units[0].id
  activeLeaseUnitId = unitId

  // Create tenant
  const tenantRes = await request.post(`${apiUrl}/api/v1/tenants`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: { name: `Inq Contrato BDD ${Date.now()}`, person_type: 'PF' },
  })
  expect(tenantRes.ok()).toBeTruthy()
  const { data: tenant } = await tenantRes.json()
  toDelete.tenantIds.push(tenant.id)

  // Create lease
  const leaseRes = await request.post(`${apiUrl}/api/v1/leases`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: {
      unit_id: unitId,
      tenant_id: tenant.id,
      start_date: '2026-01-01T00:00:00Z',
      rent_amount: 1000,
      payment_day: 5,
    },
  })
  expect(leaseRes.ok()).toBeTruthy()
  const { data: lease } = await leaseRes.json()
  toDelete.leaseIds.push(lease.id)
})

Given(
  'que existe um imóvel com unidade disponível criado via API para contrato',
  async ({ request, apiToken, apiUrl }) => {
    // Create property (SINGLE auto-creates a unit)
    const propRes = await request.post(`${apiUrl}/api/v1/properties`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: `Prop Disp BDD ${Date.now()}`, type: 'SINGLE' },
    })
    expect(propRes.ok()).toBeTruthy()
    const { data: prop } = await propRes.json()
    toDelete.propertyIds.push(prop.id)

    // Get unit ID from property detail
    const detailRes = await request.get(`${apiUrl}/api/v1/properties/${prop.id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    const { data: propDetail } = await detailRes.json()
    availableUnitId = propDetail.units[0].id
  },
)

Given(
  'que existe um inquilino disponível criado via API para contrato',
  async ({ request, apiToken, apiUrl }) => {
    const res = await request.post(`${apiUrl}/api/v1/tenants`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: `Inq Disp BDD ${Date.now()}`, person_type: 'PF' },
    })
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    toDelete.tenantIds.push(data.id)
    availableTenantId = data.id
  },
)

When('clico no botão de novo contrato', async ({}) => {
  await leasesPage.clicarNovoContrato()
})

When('seleciono a unidade disponível no formulário de contrato', async ({}) => {
  await leasesPage.selecionarUnidade(availableUnitId)
})

When('seleciono o inquilino disponível no formulário de contrato', async ({}) => {
  await leasesPage.selecionarInquilino(availableTenantId)
})

When('preencho a data de início com {string}', async ({}, data: string) => {
  await leasesPage.preencherDataInicio(data)
})

When('preencho o valor do aluguel com {string}', async ({}, valor: string) => {
  await leasesPage.preencherValorAluguel(valor)
})

When('preencho o dia de pagamento com {string}', async ({}, dia: string) => {
  await leasesPage.preencherDiaPagamento(dia)
})

When('submeto o formulário de contrato', async ({}) => {
  await leasesPage.submeterFormulario()
})

When('encerro o contrato ativo', async ({}) => {
  // The "Encerrar Contrato" button is on the unit detail page, not the leases list
  await leasesPage.navegarParaUnidade(activeLeaseUnitId)
  await leasesPage.encerrarContratoNaUnidade()
})

Then('devo ver pelo menos um contrato na lista', async ({}) => {
  await leasesPage.verificarPeloMenosUmContrato()
})

Then('devo ver a confirmação de contrato criado', async ({}) => {
  await leasesPage.verificarToastCriado()
})

Then('devo ver a confirmação de contrato encerrado', async ({}) => {
  await leasesPage.verificarToastEncerrado()
})

After(async ({ request, apiToken, apiUrl }) => {
  for (const id of toDelete.leaseIds) {
    await request.delete(`${apiUrl}/api/v1/leases/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  for (const id of toDelete.tenantIds) {
    await request.delete(`${apiUrl}/api/v1/tenants/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  for (const id of toDelete.propertyIds) {
    await request.delete(`${apiUrl}/api/v1/properties/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  toDelete.leaseIds.length = 0
  toDelete.tenantIds.length = 0
  toDelete.propertyIds.length = 0
  availableUnitId = ''
  availableTenantId = ''
  activeLeaseUnitId = ''
})
