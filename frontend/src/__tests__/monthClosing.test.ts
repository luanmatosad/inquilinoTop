import { describe, it, expect } from 'vitest'
import { isPastMonth, pendingSummary, buildChecklist, closedAtLabel, type ClosingSnapshot } from '@/lib/month-closing'

const NOW = new Date('2026-11-07T15:00:00Z')

const snap = (o: Partial<ClosingSnapshot> = {}): ClosingSnapshot => ({
  forecast: { count: 5, total: 8300 },
  received: { count: 4, total: 6750 },
  overdue: { count: 1, total: 1550 },
  receipts_issued: 4,
  pending: [{ payment_id: 'p1', tenant: 'Bruno Lima', amount: 1550, due_date: '2026-10-05', awaiting: false }],
  ...o,
})

describe('isPastMonth', () => {
  it('só meses anteriores ao corrente em São Paulo', () => {
    expect(isPastMonth('2026-10', NOW)).toBe(true)
    expect(isPastMonth('2026-11', NOW)).toBe(false)
    expect(isPastMonth('2026-12', NOW)).toBe(false)
  })
  it('virada de mês usa o fuso de São Paulo', () => {
    // 01/12 02:00 UTC ainda é 30/11 em São Paulo
    expect(isPastMonth('2026-11', new Date('2026-12-01T02:00:00Z'))).toBe(false)
    expect(isPastMonth('2026-11', new Date('2026-12-01T04:00:00Z'))).toBe(true)
  })
})

describe('pendingSummary', () => {
  it('sem pendências', () => expect(pendingSummary([])).toBe('sem pendências'))
  it('uma com nome', () => expect(pendingSummary(snap().pending)).toBe('com 1 pendência (Bruno Lima)'))
  it('várias sem listar nomes', () => {
    const p = [...snap().pending, { payment_id: 'p2', tenant: 'Ana', amount: 1, due_date: '2026-10-06', awaiting: true }]
    expect(pendingSummary(p)).toBe('com 2 pendências')
  })
})

describe('buildChecklist', () => {
  it('tudo certo exceto o atraso', () => {
    const c = buildChecklist(snap())
    expect(c.map((i) => i.key)).toEqual(['awaiting', 'receipts', 'late'])
    expect(c[0]).toMatchObject({ ok: true, text: 'Nenhum aguardando confirmação.' })
    expect(c[1]).toMatchObject({ ok: true, text: '4 de 4 pagamentos têm recibo.' })
    expect(c[2]).toMatchObject({ ok: false, title: '1 cobrança em atraso', text: 'Bruno Lima · 05/10/2026' })
  })
  it('aviso aguardando e recibo faltando', () => {
    const c = buildChecklist(
      snap({
        receipts_issued: 3,
        overdue: { count: 1, total: 100 },
        pending: [{ payment_id: 'p', tenant: 'Ana', amount: 100, due_date: '2026-10-05', awaiting: true }],
      }),
    )
    expect(c[0]).toMatchObject({ ok: false, text: '1 aguardando confirmação: Ana.' })
    expect(c[1]).toMatchObject({ ok: false, text: '3 de 4 pagamentos têm recibo.' })
  })
  it('sem atraso', () => {
    const c = buildChecklist(snap({ overdue: { count: 0, total: 0 }, pending: [] }))
    expect(c[2]).toMatchObject({ ok: true, title: 'Nenhuma cobrança em atraso' })
  })
})

describe('closedAtLabel', () => {
  it('data e hora em São Paulo', () => {
    expect(closedAtLabel('2026-11-03T00:05:00Z')).toBe('02/11/2026, 21:05')
  })
})
