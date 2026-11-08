import { describe, it, expect } from 'vitest'
import {
  parsePeriod,
  rowSituation,
  buildStatementRows,
  statementIndicators,
  agreementsOf,
  readjustmentsOf,
  oldestOpen,
  visibleRows,
  type StatementPayment,
} from '@/lib/tenant-statement'

const NOW = new Date('2026-11-07T15:00:00Z')

const pay = (o: Partial<StatementPayment> & { id: string; due_date: string }): StatementPayment => ({
  lease_id: 'l1',
  type: 'RENT',
  status: 'PENDING',
  gross_amount: 1850,
  late_fee_amount: 0,
  interest_amount: 0,
  ...o,
})

describe('parsePeriod', () => {
  it('padrão: 12 meses até o fim do mês corrente', () => {
    expect(parsePeriod({}, NOW)).toMatchObject({ kind: '12m', from: '2025-12-01', to: '2026-11-30' })
  })
  it('ano calendário', () => {
    expect(parsePeriod({ periodo: '2025' }, NOW)).toMatchObject({ kind: 'year', from: '2025-01-01', to: '2025-12-31' })
  })
  it('personalizado por mês', () => {
    expect(parsePeriod({ periodo: 'custom', de: '2026-03', ate: '2026-05' }, NOW)).toMatchObject({
      kind: 'custom',
      from: '2026-03-01',
      to: '2026-05-31',
    })
  })
  it('invertido ou inválido volta a 12 meses', () => {
    expect(parsePeriod({ periodo: 'custom', de: '2026-06', ate: '2026-05' }, NOW).kind).toBe('12m')
    expect(parsePeriod({ periodo: 'custom', de: 'x', ate: '2026-05' }, NOW).kind).toBe('12m')
    expect(parsePeriod({ periodo: 'abc' }, NOW).kind).toBe('12m')
  })
})

describe('rowSituation', () => {
  it('paga em dia, paga com atraso, atrasada, aguardando e prevista', () => {
    expect(rowSituation(pay({ id: 'a', due_date: '2026-08-25', status: 'PAID', paid_date: '2026-08-25T00:00:00Z' }))).toBe('PAID')
    expect(rowSituation(pay({ id: 'a', due_date: '2026-08-25', status: 'PAID', paid_date: '2026-08-27T00:00:00Z' }))).toBe('PAID_LATE')
    expect(rowSituation(pay({ id: 'a', due_date: '2026-10-25', status: 'LATE' }))).toBe('LATE')
    expect(rowSituation(pay({ id: 'a', due_date: '2026-11-20', awaiting_confirmation: true }))).toBe('AWAITING')
    expect(rowSituation(pay({ id: 'a', due_date: '2026-11-20' }))).toBe('PENDING')
  })
})

describe('buildStatementRows', () => {
  it('só aluguel, vencimento decrescente, valor líquido quando paga', () => {
    const rows = buildStatementRows([
      pay({ id: 'a', due_date: '2026-09-05', status: 'PAID', paid_date: '2026-09-05T00:00:00Z', net_amount: 1800 }),
      pay({ id: 'b', due_date: '2026-10-05', status: 'PENDING' }),
      pay({ id: 'c', due_date: '2026-10-05', type: 'OTHER' }),
    ])
    expect(rows.map((r) => r.payment.id)).toEqual(['b', 'a'])
    expect(rows[1].amount).toBe(1800)
    expect(rows[0].amount).toBe(1850)
  })
})

describe('statementIndicators', () => {
  it('em dia: 12 de 12 e atrasos 0', () => {
    const rows = buildStatementRows(
      Array.from({ length: 12 }, (_, i) =>
        pay({ id: 'p' + i, due_date: `2026-${String((i % 9) + 1).padStart(2, '0')}-0${(i % 3) + 1}`, status: 'PAID', paid_date: '2026-01-01T00:00:00Z', net_amount: 1850 }),
      ).map((p) => ({ ...p, paid_date: p.due_date + 'T00:00:00Z' })),
    )
    const k = statementIndicators(rows, NOW)
    expect(k.punctual).toEqual({ onTime: 12, paid: 12, late: 0 })
    expect(k.received).toEqual({ total: 22200, count: 12 })
    expect(k.overdueNow).toBeNull()
    expect(k.lateCount).toBe(0)
  })
  it('sem pagamentos: pontualidade vazia', () => {
    const k = statementIndicators(buildStatementRows([pay({ id: 'a', due_date: '2026-11-20' })]), NOW)
    expect(k.punctual.paid).toBe(0)
  })
  it('atrasada há 8 dias: em atraso agora com total e mês', () => {
    const rows = buildStatementRows([
      pay({ id: 'a', due_date: '2026-10-30', status: 'LATE', late_fee_amount: 37, interest_amount: 3 }),
      pay({ id: 'b', due_date: '2026-09-05', status: 'PAID', paid_date: '2026-09-06T00:00:00Z', net_amount: 1850 }),
    ])
    const k = statementIndicators(rows, NOW)
    expect(k.overdueNow).toEqual({ total: 1890, count: 1, days: 8, month: 'Outubro' })
    expect(k.punctual).toEqual({ onTime: 0, paid: 1, late: 1 })
  })
})

describe('agreements, reajustes e cobrança aberta', () => {
  it('acordo: original diferente do vencimento atual', () => {
    const list = agreementsOf([
      pay({ id: 'a', due_date: '2026-09-20', original_due_date: '2026-09-05T00:00:00Z' }),
      pay({ id: 'b', due_date: '2026-10-05' }),
      pay({ id: 'c', due_date: '2026-08-05', original_due_date: '2026-08-05T00:00:00Z' }),
    ])
    expect(list).toEqual([{ id: 'a', from: '2026-09-05', to: '2026-09-20' }])
  })
  it('reajustes mais recentes primeiro', () => {
    const list = readjustmentsOf([
      { applied_at: '2025-03-01T00:00:00Z', old_amount: 1700, new_amount: 1750 },
      { applied_at: '2026-03-01T00:00:00Z', old_amount: 1750, new_amount: 1850 },
    ])
    expect(list.map((r) => r.newAmount)).toEqual([1850, 1750])
  })
  it('cobrança aberta mais antiga', () => {
    const rows = buildStatementRows([
      pay({ id: 'a', due_date: '2026-10-05', status: 'LATE' }),
      pay({ id: 'b', due_date: '2026-11-05' }),
      pay({ id: 'c', due_date: '2026-09-05', status: 'PAID', paid_date: '2026-09-05T00:00:00Z' }),
    ])
    expect(oldestOpen(rows)?.payment.id).toBe('a')
    expect(oldestOpen(rows.filter((r) => r.situation === 'PAID'))).toBeNull()
  })
})

describe('visibleRows', () => {
  const rows = buildStatementRows(Array.from({ length: 9 }, (_, i) => pay({ id: 'p' + i, due_date: `2026-0${i + 1}-05` })))
  it('seis mais recentes por padrão', () => {
    const v = visibleRows(rows, false)
    expect(v.rows).toHaveLength(6)
    expect(v.label).toBe('Mostrando 6 dos 9 meses')
    expect(v.hasMore).toBe(true)
  })
  it('todos', () => {
    const v = visibleRows(rows, true)
    expect(v.rows).toHaveLength(9)
    expect(v.hasMore).toBe(false)
  })
  it('poucas linhas: sem ver todos', () => {
    expect(visibleRows(rows.slice(0, 3), false).hasMore).toBe(false)
  })
})
