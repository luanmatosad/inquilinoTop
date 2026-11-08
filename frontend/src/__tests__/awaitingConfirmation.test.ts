import { describe, it, expect } from 'vitest'

import { buildReceivableRows, chipCounts, filterBySituation, receivableIndicators, type OverviewPayment } from '@/lib/financial-overview'

const pay = (id: string, over: Partial<OverviewPayment> = {}): OverviewPayment => ({
  id,
  lease_id: 'l1',
  type: 'RENT',
  status: 'PENDING',
  due_date: '2026-11-05',
  gross_amount: 1000,
  ...over,
})

const rows = (payments: OverviewPayment[]) =>
  buildReceivableRows({ payments, leases: [{ id: 'l1', tenant_id: 't1', unit_id: 'u1' }], tenants: [{ id: 't1', name: 'Marina' }], properties: [] })

describe('Aguardando confirmação em Recebimentos', () => {
  const all = rows([
    pay('a', { awaiting_confirmation: true }),
    pay('b', { status: 'LATE', awaiting_confirmation: true }),
    pay('c', { status: 'LATE' }),
    pay('d', { status: 'PAID' }),
    pay('e'),
  ])

  it('cobrança com aviso pendente tem situação AWAITING, mesmo atrasada', () => {
    const bySituation = Object.fromEntries(all.map((r) => [r.payment.id, r.situation]))
    expect(bySituation).toEqual({ a: 'AWAITING', b: 'AWAITING', c: 'LATE', d: 'PAID', e: 'PENDING' })
  })

  it('cobrança paga nunca é AWAITING', () => {
    const r = rows([pay('x', { status: 'PAID', awaiting_confirmation: true })])
    expect(r[0].situation).toBe('PAID')
  })

  it('contagem do chip e filtro', () => {
    expect(chipCounts(all).AWAITING).toBe(2)
    expect(filterBySituation(all, 'AWAITING').map((r) => r.payment.id).sort()).toEqual(['a', 'b'])
  })

  it('indicadores: aguardando não entra em atraso nem em recebido', () => {
    const k = receivableIndicators(all)
    expect(k.late.count).toBe(1)
    expect(k.received.count).toBe(1)
    expect(k.forecast.count).toBe(5)
  })
})
