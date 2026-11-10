import { describe, it, expect } from 'vitest'

import { buildChecklist, buildToday, dateLabel, greeting, headline } from '@/lib/today-overview'
import type { OverviewPayment } from '@/lib/financial-overview'

const NOW = new Date('2026-11-07T15:00:00Z') // sábado, 12:00 em São Paulo

describe('saudação, data e frase', () => {
  it.each([
    ['2026-11-07T11:00:00Z', 'Bom dia'],
    ['2026-11-07T14:59:00Z', 'Bom dia'], // 11:59
    ['2026-11-07T15:00:00Z', 'Boa tarde'], // 12:00
    ['2026-11-07T20:59:00Z', 'Boa tarde'], // 17:59
    ['2026-11-07T21:00:00Z', 'Boa noite'], // 18:00
    ['2026-11-08T05:00:00Z', 'Boa noite'], // 02:00
    ['2026-11-07T08:00:00Z', 'Bom dia'], // 05:00
  ])('%s → %s', (iso, expected) => expect(greeting(new Date(iso))).toBe(expected))

  it('data por extenso com a primeira letra maiúscula', () => {
    expect(dateLabel(new Date('2026-11-02T15:00:00Z'))).toBe('Segunda-feira, 2 de novembro')
    expect(dateLabel(new Date('2026-11-07T15:00:00Z'))).toBe('Sábado, 7 de novembro')
  })

  it('frase de contagem', () => {
    expect(headline(0)).toBe('Nada para resolver hoje.')
    expect(headline(1)).toBe('Você tem 1 coisa para resolver hoje.')
    expect(headline(6)).toBe('Você tem 6 coisas para resolver hoje.')
  })
})

const pay = (id: string, status: string, due: string, over: Partial<OverviewPayment> = {}): OverviewPayment => ({
  id,
  lease_id: 'l1',
  type: 'RENT',
  status,
  due_date: `${due}T00:00:00Z`,
  gross_amount: 1000,
  ...over,
})

const leases = [
  { id: 'l1', tenant_id: 't1', unit_id: 'u1', status: 'ACTIVE', start_date: '2025-01-01T00:00:00Z', rent_amount: 1000 },
]
const tenants = [{ id: 't1', name: 'Marina Souza' }]
const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Ap 302' }] }]

const build = (payments: OverviewPayment[], ls: unknown[] = leases) =>
  buildToday({ payments, leases: ls as never, tenants, properties, now: NOW })

describe('listas do dia', () => {
  const payments = [
    pay('a', 'LATE', '2026-11-05', { awaiting_confirmation: true, reported_at: '2026-11-07T12:12:00Z', reported_amount: 1000 }),
    pay('b', 'PENDING', '2026-11-10', { awaiting_confirmation: true, reported_at: '2026-11-06T21:40:00Z', reported_amount: 1000, has_proof: true }),
    pay('c', 'LATE', '2026-10-25', { late_fee_amount: 20, interest_amount: 5 }),
    pay('d', 'LATE', '2026-10-30'),
    pay('e', 'PENDING', '2026-11-10'),
    pay('f', 'PENDING', '2026-11-07'),
    pay('g', 'PENDING', '2026-11-15'), // 8 dias: fora da janela
    pay('h', 'PAID', '2026-11-02'),
    pay('x', 'PENDING', '2026-11-08', { type: 'EXPENSE' }), // só aluguel
  ]
  const t = build(payments)

  it('Confirmar: avisos pendentes, do mais antigo ao mais novo, mesmo atrasados', () => {
    expect(t.confirm.map((r) => r.id)).toEqual(['b', 'a'])
    expect(t.confirm[0]).toMatchObject({ tenant: 'Marina Souza', where: 'Ap 302 · Ed. Aurora', hasProof: true, reportedAmount: 1000 })
  })

  it('Atrasados: sem aviso, da mais atrasada à menos, com dias de atraso', () => {
    expect(t.late.map((r) => r.id)).toEqual(['c', 'd'])
    expect(t.late.map((r) => r.daysLate)).toEqual([13, 8])
    expect(t.late[0].totalDue).toBe(1025)
  })

  it('Para cobrar: a vencer em até 7 dias, por vencimento, com dias até vencer', () => {
    expect(t.collect.map((r) => r.id)).toEqual(['f', 'e'])
    expect(t.collect.map((r) => r.daysUntil)).toEqual([0, 3])
  })

  it('cada cobrança aparece em uma lista só', () => {
    const ids = [...t.confirm, ...t.late, ...t.collect].map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('indicadores sobre as linhas de aluguel, como em Recebimentos', () => {
    expect(t.kpis.forecast).toEqual({ total: 8000, count: 8 })
    expect(t.kpis.received).toEqual({ total: 1000, count: 1 })
    expect(t.kpis.late).toEqual({ total: 2000, count: 2 })
    expect(t.kpis.receivedPercent).toBe(13)
    expect(t.kpis.oldestLateDays).toBe(13)
  })

  it('sem previsto não divide por zero', () => {
    const empty = build([])
    expect(empty.kpis.receivedPercent).toBe(0)
    expect(empty.kpis.oldestLateDays).toBe(0)
  })
})

describe('Fique de olho', () => {
  const l = (id: string, over: Record<string, unknown>) => ({
    id,
    tenant_id: 't1',
    unit_id: 'u1',
    status: 'ACTIVE',
    start_date: '2025-01-01T00:00:00Z',
    rent_amount: 1000,
    ...over,
  })

  it('reajuste na janela padrão (60 dias), reajuste pendente e término em 60 dias', () => {
    const t = build([], [
      l('r1', { next_readjustment: '2026-11-15T00:00:00Z', adjustment_index: 'IGPM' }),
      l('r2', { next_readjustment: '2027-03-01T00:00:00Z' }),
      l('e1', { end_date: '2026-11-30T00:00:00Z' }),
      l('x1', { status: 'ENDED', end_date: '2026-11-20T00:00:00Z', next_readjustment: '2026-11-15T00:00:00Z' }),
      l('r3', { next_readjustment: '2026-10-01T00:00:00Z' }),
      l('e2', { end_date: '2027-02-01T00:00:00Z' }),
    ])
    expect(t.watch.map((w) => `${w.kind}:${w.leaseId}`)).toEqual(['READJUST:r3', 'READJUST:r1', 'ENDING:e1'])
    const r1 = t.watch.find((w) => w.leaseId === 'r1')!
    expect(r1).toMatchObject({ where: 'Ap 302 · Ed. Aurora', date: '2026-11-15', index: 'IGPM', pending: false })
    expect(t.watch.find((w) => w.leaseId === 'r3')).toMatchObject({ pending: true })
    expect(t.watch.find((w) => w.leaseId === 'e1')).toMatchObject({ date: '2026-11-30', days: 23 })
  })

  describe('dias de aviso do reajuste (Regras financeiras)', () => {
    // hoje é 07/11/2026: 26/12 está a 49 dias e 06/01/2027 a 60
    const withDays = (days: number | undefined, next: string) =>
      buildToday({ payments: [], leases: [l('r', { next_readjustment: `${next}T00:00:00Z` })] as never, tenants, properties, now: NOW, readjustNoticeDays: days })
        .watch.filter((w) => w.kind === 'READJUST').length

    it('sem o parâmetro vale 60 dias (e não mais 30)', () => {
      expect(withDays(undefined, '2026-12-26')).toBe(1)
      expect(withDays(undefined, '2027-01-06')).toBe(1)
      expect(withDays(undefined, '2027-01-07')).toBe(0)
    })
    it('usa os dias informados, com o limite inclusive', () => {
      expect(withDays(45, '2026-12-26')).toBe(0)
      expect(withDays(49, '2026-12-26')).toBe(1)
      expect(withDays(30, '2026-12-08')).toBe(0)
      expect(withDays(30, '2026-12-07')).toBe(1)
    })
    it('o reajuste pendente aparece com qualquer janela', () => {
      expect(withDays(1, '2026-10-01')).toBe(1)
    })
    it('o término continua em 60 dias, independente do aviso do reajuste', () => {
      const t = buildToday({ payments: [], leases: [l('e', { end_date: '2027-01-05T00:00:00Z' })] as never, tenants, properties, now: NOW, readjustNoticeDays: 5 })
      expect(t.watch.map((w) => w.kind)).toEqual(['ENDING'])
    })
  })

  it('a contagem soma todas as listas', () => {
    const t = build(
      [pay('a', 'PENDING', '2026-11-10', { awaiting_confirmation: true, reported_at: '2026-11-07T12:00:00Z', reported_amount: 1 }), pay('c', 'LATE', '2026-10-25'), pay('e', 'PENDING', '2026-11-09')],
      [l('e1', { end_date: '2026-11-30T00:00:00Z' })],
    )
    expect(t.count).toBe(4)
  })
})

describe('Primeiros passos', () => {
  it('conta nova: só "criar a conta" feito', () => {
    const c = buildChecklist({ properties: 0, tenants: 0, leases: 0, hasPix: false })
    expect(c.done).toBe(1)
    expect(c.total).toBe(5)
    expect(c.steps.map((s) => s.done)).toEqual([true, false, false, false, false])
    expect(c.steps[1].href).toBe('/properties?novo=1')
    expect(c.steps[2].href).toBe('/tenants?novo=1')
    expect(c.steps[4].href).toBe('/settings/financial')
  })

  it('contrato fica bloqueado sem imóvel e inquilino', () => {
    expect(buildChecklist({ properties: 1, tenants: 0, leases: 0, hasPix: false }).steps[3].blocked).toBe(true)
    expect(buildChecklist({ properties: 0, tenants: 1, leases: 0, hasPix: false }).steps[3].blocked).toBe(true)
    const ok = buildChecklist({ properties: 1, tenants: 1, leases: 0, hasPix: false })
    expect(ok.steps[3].blocked).toBe(false)
    expect(ok.done).toBe(3)
    expect(ok.steps[3].href).toBe('/leases?novo=1')
  })

  it('Pix cadastrado conta como feito', () => {
    expect(buildChecklist({ properties: 1, tenants: 1, leases: 1, hasPix: true }).done).toBe(5)
  })
})
