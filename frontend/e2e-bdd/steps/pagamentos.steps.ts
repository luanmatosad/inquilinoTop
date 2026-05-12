// frontend/e2e-bdd/steps/pagamentos.steps.ts
import { createBdd } from 'playwright-bdd'
import { test, expect } from '../fixtures'
import { PaymentsPage } from '../pages/PaymentsPage'

const { Given, When, Then, Before, After } = createBdd(test)

let paymentsPage: PaymentsPage
let availableLeaseId = ''
let pendingPaymentId = ''
let pendingPaymentGrossAmount = 1200

const toDelete = {
  leaseIds: [] as string[],
  tenantIds: [] as string[],
  propertyIds: [] as string[],
}

Before(async ({ page }) => {
  paymentsPage = new PaymentsPage(page)
})

Given('que estou na página de pagamentos', async ({}) => {
  await paymentsPage.navegar()
})

Given('que existe um pagamento pendente criado via API', async ({ request, apiToken, apiUrl }) => {
  // Create property (SINGLE auto-creates a unit)
  const propRes = await request.post(`${apiUrl}/api/v1/properties`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: { name: `Prop Pgto BDD ${Date.now()}`, type: 'SINGLE' },
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

  // Create tenant
  const tenantRes = await request.post(`${apiUrl}/api/v1/tenants`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: { name: `Inq Pgto BDD ${Date.now()}`, person_type: 'PF' },
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
      rent_amount: pendingPaymentGrossAmount,
      payment_day: 5,
    },
  })
  expect(leaseRes.ok()).toBeTruthy()
  const { data: lease } = await leaseRes.json()
  toDelete.leaseIds.push(lease.id)

  // Create payment
  const paymentRes = await request.post(`${apiUrl}/api/v1/leases/${lease.id}/payments`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: {
      due_date: '2026-08-01',
      gross_amount: pendingPaymentGrossAmount,
      type: 'RENT',
      description: 'Aluguel BDD Teste',
    },
  })
  expect(paymentRes.ok()).toBeTruthy()
  const { data: payment } = await paymentRes.json()
  pendingPaymentId = payment.id
})

Given(
  'que existe um contrato ativo disponível para pagamento criado via API',
  async ({ request, apiToken, apiUrl }) => {
    // Create property (SINGLE auto-creates a unit)
    const propRes = await request.post(`${apiUrl}/api/v1/properties`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: `Prop Contrato Pgto BDD ${Date.now()}`, type: 'SINGLE' },
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

    // Create tenant
    const tenantRes = await request.post(`${apiUrl}/api/v1/tenants`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: `Inq Contrato Pgto BDD ${Date.now()}`, person_type: 'PF' },
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
    availableLeaseId = lease.id
  },
)

When('navego para a lista de pagamentos', async ({}) => {
  await paymentsPage.navegar()
})

When('clico no botão de novo pagamento', async ({}) => {
  await paymentsPage.clicarNovoPagamento()
})

When('seleciono o contrato disponível no formulário de pagamento', async ({}) => {
  await paymentsPage.selecionarContrato(availableLeaseId)
})

When('seleciono o tipo de pagamento {string}', async ({}, tipo: string) => {
  await paymentsPage.selecionarTipoPagamento(tipo)
})

When('preencho a descrição do pagamento com {string}', async ({}, descricao: string) => {
  await paymentsPage.preencherDescricao(descricao)
})

When('preencho o valor do pagamento com {string}', async ({}, valor: string) => {
  await paymentsPage.preencherValor(valor)
})

When('preencho o vencimento com {string}', async ({}, data: string) => {
  await paymentsPage.preencherVencimento(data)
})

When('submeto o formulário de pagamento', async ({}) => {
  await paymentsPage.submeterFormulario()
})

When('marco o pagamento como pago via API', async ({ request, apiToken, apiUrl }) => {
  const res = await request.put(`${apiUrl}/api/v1/payments/${pendingPaymentId}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: {
      status: 'PAID',
      gross_amount: pendingPaymentGrossAmount,
      paid_date: new Date().toISOString(),
    },
  })
  expect(res.ok()).toBeTruthy()
})

Then('devo ver pelo menos um pagamento na lista', async ({}) => {
  await paymentsPage.verificarPeloMenosUmPagamento()
})

Then('devo ver a confirmação de pagamento registrado', async ({}) => {
  await paymentsPage.verificarToastPagamentoRegistrado()
})

Then('o pagamento deve ter status PAID', async ({ request, apiToken, apiUrl }) => {
  const res = await request.get(`${apiUrl}/api/v1/payments/${pendingPaymentId}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  expect(res.ok()).toBeTruthy()
  const { data: payment } = await res.json()
  expect(payment.status).toBe('PAID')
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
  availableLeaseId = ''
  pendingPaymentId = ''
})
