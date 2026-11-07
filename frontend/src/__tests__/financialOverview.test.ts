import { describe, it, expect } from 'vitest'
import {
  buildPayableRows,
  buildReceivableRows,
  chipCounts,
  filterBySituation,
  filterPayables,
  payableChipCounts,
  formatMonthLabel,
  monthRange,
  parseMonth,
  payableIndicators,
  receivableIndicators,
  shiftMonth,
  type OverviewExpense,
  type OverviewPayment,
} from '@/lib/financial-overview'

const NOW = new Date('2026-11-07T15:00:00Z')

describe('mês', () => {
  it('padrão é o mês corrente em São Paulo', () => {
    expect(parseMonth(undefined, NOW)).toBe('2026-11')
    expect(parseMonth('', NOW)).toBe('2026-11')
  })
  it('virada: 23h do último dia em SP ainda é o mês anterior ao UTC', () => {
    expect(parseMonth(undefined, new Date('2026-12-01T02:00:00Z'))).toBe('2026-11')
  })
  it('inválido cai no corrente', () => {
    for (const v of ['abc', '2026-13', '2026-00', '2026-1', '26-11']) expect(parseMonth(v, NOW)).toBe('2026-11')
  })
  it('valor válido é mantido', () => expect(parseMonth('2026-10', NOW)).toBe('2026-10'))
  it('intervalo do mês, inclusive fevereiro bissexto', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
  it('anterior e próximo, com virada de ano', () => {
    expect(shiftMonth('2026-11', -1)).toBe('2026-10')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
  it('rótulo', () => expect(formatMonthLabel('2026-11')).toBe('Novembro de 2026'))
})

const pay = (id: string, o: Partial<OverviewPayment> = {}): OverviewPayment => ({
  id, lease_id: 'l1', type: 'RENT', status: 'PENDING', due_date: '2026-11-05T00:00:00Z', gross_amount: 1000, ...o,
})
const leases = [{ id: 'l1', tenant_id: 't1', unit_id: 'u302' }]
const tenants = [{ id: 't1', name: 'Marina Souza' }]
const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u302', label: 'Ap 302' }] }]

describe('buildReceivableRows', () => {
  it('linha completa', () => {
    const [r] = buildReceivableRows({ payments: [pay('a', { status: 'PAID', gross_amount: 1850 })], leases, tenants, properties })
    expect(r.tenantName).toBe('Marina Souza')
    expect(r.where).toBe('Ap 302 · Ed. Aurora')
    expect(r.situation).toBe('PAID')
  })
  it('une mês e atrasadas sem duplicar, ordena por vencimento', () => {
    const rows = buildReceivableRows({
      payments: [pay('a'), pay('b', { status: 'LATE', due_date: '2026-10-25T00:00:00Z' }), pay('b', { status: 'LATE', due_date: '2026-10-25T00:00:00Z' })],
      leases, tenants, properties,
    })
    expect(rows.map((r) => r.payment.id)).toEqual(['b', 'a'])
  })
  it('só aluguel', () => {
    const rows = buildReceivableRows({ payments: [pay('a'), pay('b', { type: 'EXPENSE' }), pay('c', { type: 'DEPOSIT' })], leases, tenants, properties })
    expect(rows).toHaveLength(1)
  })
  it('dados ausentes viram "—"', () => {
    const [r] = buildReceivableRows({ payments: [pay('a', { lease_id: 'x' })], leases, tenants: [], properties: [] })
    expect(r.tenantName).toBe('—')
    expect(r.where).toBe('—')
    const [r2] = buildReceivableRows({ payments: [pay('a')], leases, tenants: [], properties: [] })
    expect(r2.tenantName).toBe('—')
    expect(r2.where).toBe('—')
  })
})

describe('receivableIndicators', () => {
  const rows = (items: [string, string, number][]) =>
    buildReceivableRows({ payments: items.map(([id, status, gross_amount]) => pay(id, { status, gross_amount })), leases, tenants, properties })
  it('indicadores do canvas', () => {
    const k = receivableIndicators(rows([['1', 'PAID', 1850], ['2', 'PENDING', 1600], ['3', 'LATE', 1550], ['4', 'PAID', 2200], ['5', 'PENDING', 1100]]))
    expect(k.forecast).toEqual({ total: 8300, count: 5 })
    expect(k.received).toEqual({ total: 4050, count: 2 })
    expect(k.late).toEqual({ total: 1550, count: 1 })
  })
  it('sem atrasadas', () => {
    expect(receivableIndicators(rows([['1', 'PAID', 100]])).late).toEqual({ total: 0, count: 0 })
  })
  it('soma sem deriva de ponto flutuante', () => {
    expect(receivableIndicators(rows([['1', 'PENDING', 0.1], ['2', 'PENDING', 0.2]])).forecast.total).toBe(0.3)
  })
})

describe('chips de situação', () => {
  const rs = buildReceivableRows({
    payments: [pay('1', { status: 'PAID' }), pay('2'), pay('3', { status: 'LATE' }), pay('4')],
    leases, tenants, properties,
  })
  it('contagens', () => expect(chipCounts(rs)).toEqual({ ALL: 4, LATE: 1, PAID: 1, PENDING: 2 }))
  it('filtra', () => {
    expect(filterBySituation(rs, 'LATE')).toHaveLength(1)
    expect(filterBySituation(rs, 'PENDING')).toHaveLength(2)
    expect(filterBySituation(rs, undefined)).toHaveLength(4)
    expect(filterBySituation(rs, 'lixo')).toHaveLength(4)
  })
})

const exp = (id: string, o: Partial<OverviewExpense> = {}): OverviewExpense => ({
  id, unit_id: 'u302', description: 'Pintura da sala', amount: 800, due_date: '2026-11-12T00:00:00Z', category: 'MAINTENANCE', status: 'PENDING', ...o,
})

describe('despesas', () => {
  it('linha completa e categoria em português', () => {
    const [r] = buildPayableRows({ expenses: [exp('a')], properties })
    expect(r.where).toBe('Ap 302 · Ed. Aurora')
    expect(r.categoryLabel).toBe('Manutenção')
    expect(r.situation).toBe('PENDING')
  })
  it('todas as categorias', () => {
    const labels = ['ELECTRICITY', 'WATER', 'CONDO', 'TAX', 'MAINTENANCE', 'OTHER'].map(
      (c) => buildPayableRows({ expenses: [exp('a', { category: c })], properties })[0].categoryLabel,
    )
    expect(labels).toEqual(['Energia', 'Água', 'Condomínio', 'Impostos', 'Manutenção', 'Outros'])
  })
  it('unidade ausente', () => {
    expect(buildPayableRows({ expenses: [exp('a', { unit_id: 'x' })], properties })[0].where).toBe('—')
  })
  it('une sem duplicar e ordena', () => {
    const rows = buildPayableRows({ expenses: [exp('a'), exp('b', { status: 'LATE', due_date: '2026-10-30T00:00:00Z' }), exp('b', { status: 'LATE', due_date: '2026-10-30T00:00:00Z' })], properties })
    expect(rows.map((r) => r.expense.id)).toEqual(['b', 'a'])
  })
  it('indicadores do canvas', () => {
    const rows = buildPayableRows({
      expenses: [exp('1'), exp('2', { amount: 680, status: 'PAID' }), exp('3', { amount: 420, status: 'PAID' }), exp('4', { amount: 240, status: 'PAID' })],
      properties,
    })
    const k = payableIndicators(rows)
    expect(k.total).toEqual({ total: 2140, count: 4 })
    expect(k.paid).toEqual({ total: 1340, count: 3 })
    expect(k.toPay).toEqual({ total: 800, count: 1 })
  })
  it('A pagar inclui atrasadas', () => {
    const rows = buildPayableRows({ expenses: [exp('1', { status: 'LATE' }), exp('2', { status: 'PAID' }), exp('3')], properties })
    expect(payableIndicators(rows).toPay.count).toBe(2)
    expect(filterPayables(rows, 'PENDING')).toHaveLength(2)
    expect(filterPayables(rows, 'PAID')).toHaveLength(1)
    expect(filterPayables(rows, undefined)).toHaveLength(3)
    expect(payableChipCounts(rows)).toEqual({ ALL: 3, PENDING: 2, PAID: 1 })
  })
})
