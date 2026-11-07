import { describe, it, expect } from 'vitest'

import { buildTenantOverview, currentMonthRange } from '@/lib/tenant-overview'

const tenant = (id: string, name = id) => ({ id, name })
const lease = (id: string, tenant_id: string, unit_id: string, status = 'ACTIVE', start_date = '2025-03-10') => ({
  id,
  tenant_id,
  unit_id,
  status,
  start_date,
  rent_amount: 1850,
  payment_day: 5,
})
const property = (id: string, name: string, ...units: [string, string][]) => ({
  id,
  name,
  units: units.map(([uid, label]) => ({ id: uid, label })),
})
const pay = (lease_id: string, status: string, type = 'RENT', due_date = '2026-11-05') => ({
  lease_id,
  status,
  type,
  due_date,
  gross_amount: 1850,
})

const props = [property('p1', 'Ed. Aurora', ['u302', 'Ap 302'], ['u101', 'Ap 101'])]

function overview(opts: {
  tenants?: ReturnType<typeof tenant>[]
  leases?: ReturnType<typeof lease>[]
  month?: ReturnType<typeof pay>[]
  late?: ReturnType<typeof pay>[]
}) {
  return buildTenantOverview({
    tenants: opts.tenants ?? [tenant('t1')],
    leases: opts.leases ?? [],
    properties: props,
    monthPayments: opts.month ?? [],
    latePayments: opts.late ?? [],
  })
}

describe('contrato atual', () => {
  it('contrato ACTIVE é o contrato atual', () => {
    const o = overview({ leases: [lease('l1', 't1', 'u302')] }).get('t1')!
    expect(o.lease?.id).toBe('l1')
  })

  it('com dois ACTIVE vale o de start_date mais recente', () => {
    const o = overview({
      leases: [lease('antigo', 't1', 'u101', 'ACTIVE', '2024-01-01'), lease('novo', 't1', 'u302', 'ACTIVE', '2025-06-01')],
    }).get('t1')!
    expect(o.lease?.id).toBe('novo')
    expect(o.unit?.label).toBe('Ap 302')
  })

  it.each(['ENDED', 'CANCELED'])('só contrato %s: sem contrato', (status) => {
    const o = overview({ leases: [lease('l1', 't1', 'u302', status)] }).get('t1')!
    expect(o.lease).toBeNull()
    expect(o.billing).toBe('NO_LEASE')
  })

  it('inquilino sem nenhum contrato', () => {
    const o = overview({}).get('t1')!
    expect(o).toMatchObject({ lease: null, unit: null, property: null, billing: 'NO_LEASE', monthPayment: null })
  })

  it('contrato de outro inquilino não vaza', () => {
    const r = overview({ tenants: [tenant('t1'), tenant('t2')], leases: [lease('l1', 't2', 'u302')] })
    expect(r.get('t1')!.lease).toBeNull()
    expect(r.get('t2')!.lease?.id).toBe('l1')
  })
})

describe('imóvel e unidade', () => {
  it('traz unidade e imóvel do contrato atual', () => {
    const o = overview({ leases: [lease('l1', 't1', 'u302')] }).get('t1')!
    expect(o.unit).toEqual({ id: 'u302', label: 'Ap 302' })
    expect(o.property).toEqual({ id: 'p1', name: 'Ed. Aurora' })
  })

  it('unidade fora da lista de imóveis: segue com contrato, sem nome e sem erro', () => {
    const o = overview({ leases: [lease('l1', 't1', 'fantasma')] }).get('t1')!
    expect(o.lease?.id).toBe('l1')
    expect(o.unit).toBeNull()
    expect(o.property).toBeNull()
  })
})

describe('situação de cobrança', () => {
  const l = [lease('l1', 't1', 'u302')]

  it('aluguel do mês pago', () => {
    expect(overview({ leases: l, month: [pay('l1', 'PAID')] }).get('t1')!.billing).toBe('PAID')
  })

  it('aluguel do mês pendente: Previsto', () => {
    expect(overview({ leases: l, month: [pay('l1', 'PENDING')] }).get('t1')!.billing).toBe('PENDING')
  })

  it('sem pagamento no mês: sem situação', () => {
    expect(overview({ leases: l }).get('t1')!.billing).toBeNull()
  })

  it('atraso de outro mês vence o aluguel do mês pago', () => {
    const r = overview({ leases: l, month: [pay('l1', 'PAID')], late: [pay('l1', 'LATE', 'RENT', '2026-10-05')] })
    expect(r.get('t1')!.billing).toBe('LATE')
  })

  it('aluguel do próprio mês já vencido (LATE) também é atraso', () => {
    expect(overview({ leases: l, month: [pay('l1', 'LATE')] }).get('t1')!.billing).toBe('LATE')
  })

  it('atraso de outro tipo de cobrança (despesa) também conta', () => {
    const r = overview({ leases: l, late: [pay('l1', 'LATE', 'EXPENSE', '2026-10-20')] })
    expect(r.get('t1')!.billing).toBe('LATE')
  })

  it('só o aluguel decide Pago e Previsto: despesa paga + aluguel pendente = Previsto', () => {
    const r = overview({ leases: l, month: [pay('l1', 'PAID', 'EXPENSE'), pay('l1', 'PENDING', 'RENT')] })
    expect(r.get('t1')!.billing).toBe('PENDING')
  })

  it('atraso de contrato de outro inquilino não afeta', () => {
    const r = overview({
      tenants: [tenant('t1'), tenant('t2')],
      leases: [lease('l1', 't1', 'u302'), lease('l2', 't2', 'u101')],
      month: [pay('l1', 'PAID')],
      late: [pay('l2', 'LATE', 'RENT', '2026-10-05')],
    })
    expect(r.get('t1')!.billing).toBe('PAID')
    expect(r.get('t2')!.billing).toBe('LATE')
  })

  it('atraso de contrato encerrado não conta', () => {
    const r = overview({
      leases: [lease('l1', 't1', 'u302'), lease('velho', 't1', 'u101', 'ENDED', '2023-01-01')],
      month: [pay('l1', 'PAID')],
      late: [pay('velho', 'LATE', 'RENT', '2025-01-05')],
    })
    expect(r.get('t1')!.billing).toBe('PAID')
  })

  it('o pagamento de aluguel do mês fica disponível para o cartão do detalhe', () => {
    const r = overview({ leases: l, month: [pay('l1', 'PENDING', 'RENT', '2026-11-05')] })
    expect(r.get('t1')!.monthPayment).toMatchObject({ due_date: '2026-11-05', gross_amount: 1850 })
  })

  it('dois aluguéis no mês: vale o de vencimento mais recente', () => {
    const r = overview({
      leases: l,
      month: [pay('l1', 'PAID', 'RENT', '2026-11-01'), pay('l1', 'PENDING', 'RENT', '2026-11-20')],
    })
    expect(r.get('t1')!.billing).toBe('PENDING')
  })

  it('lista vazia de inquilinos', () => {
    expect(overview({ tenants: [] }).size).toBe(0)
  })
})

describe('currentMonthRange', () => {
  it('mês corrente em São Paulo', () => {
    expect(currentMonthRange(new Date('2026-11-07T15:00:00Z'))).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })

  it('fevereiro de ano bissexto', () => {
    expect(currentMonthRange(new Date('2028-02-10T12:00:00Z'))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('virada do mês: 23h do dia 30 em São Paulo já é 1º do mês seguinte em UTC', () => {
    // 2026-11-30 23:30 em São Paulo (UTC-3) = 2026-12-01 02:30 UTC
    expect(currentMonthRange(new Date('2026-12-01T02:30:00Z'))).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })

  it('já no mês seguinte em São Paulo', () => {
    expect(currentMonthRange(new Date('2026-12-01T03:30:00Z'))).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })
})
