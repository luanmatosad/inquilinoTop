import { describe, it, expect } from 'vitest'
import { buildReadjustmentHistory, buildTerms, fmtPct, paymentLabel, recentRentPayments, type DetailPayment } from '@/lib/lease-detail'

const pay = (n: number, o: Partial<DetailPayment> = {}): DetailPayment => ({
  id: `p${n}`, type: 'RENT', status: 'PAID', due_date: `2026-${String(n).padStart(2, '0')}-05T00:00:00Z`, gross_amount: 1850, ...o,
})
const NOW = new Date('2026-11-06T15:00:00Z')

describe('recentRentPayments', () => {
  it('4 mais recentes de N, só aluguel', () => {
    const ps = [...Array.from({ length: 10 }, (_, i) => pay(i + 1)), pay(11, { type: 'EXPENSE' })]
    const r = recentRentPayments(ps)
    expect(r.total).toBe(10)
    expect(r.shown.map((p) => p.id)).toEqual(['p10', 'p9', 'p8', 'p7'])
  })
})

describe('paymentLabel', () => {
  it('Pago, Atrasado e Previsto', () => {
    expect(paymentLabel(pay(1), NOW)).toBe('Pago')
    expect(paymentLabel(pay(1, { status: 'LATE' }), NOW)).toBe('Atrasado')
    expect(paymentLabel(pay(1, { status: 'PENDING' }), NOW)).toBe('Atrasado')
    expect(paymentLabel(pay(12, { status: 'PENDING' }), NOW)).toBe('Previsto')
  })
})

describe('buildReadjustmentHistory', () => {
  const lease = { start_date: '2025-03-10T00:00:00Z', rent_amount: 1850 }
  it('reajuste e linha de início com o aluguel original', () => {
    const rows = buildReadjustmentHistory(lease, [
      { applied_at: '2026-03-01T00:00:00Z', old_amount: 1760, new_amount: 1850, percentage: 0.051, index_name: 'IGP-M' },
    ])
    expect(rows[0]).toMatchObject({ when: '03/2026', label: 'IGP-M', percent: '5,1%' })
    expect(rows[0].amount).toContain('1.850,00')
    expect(rows[1]).toMatchObject({ when: '03/2025', label: 'Início', percent: '—' })
    expect(rows[1].amount).toContain('1.760,00')
  })
  it('sem reajustes: só o início com o aluguel atual', () => {
    const rows = buildReadjustmentHistory(lease, [])
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toContain('1.850,00')
  })
})

describe('buildTerms', () => {
  it('termos do canvas', () => {
    const t = Object.fromEntries(
      buildTerms({
        rent_amount: 1850, payment_day: 5, start_date: '2025-03-10T00:00:00Z', end_date: '2028-03-10T00:00:00Z',
        next_readjustment: '2027-03-01T00:00:00Z', adjustment_index: 'IGP-M', late_fee_percent: 2,
        daily_interest_percent: 0.033333, iptu_reimbursable: false,
      }).map((x) => [x.label, x.value]),
    )
    expect(t['Aluguel']).toContain('1.850,00')
    expect(t['Vencimento']).toBe('todo dia 5')
    expect(t['Período']).toBe('10/03/2025 a 10/03/2028')
    expect(t['Próx. reajuste']).toBe('03/2027 · IGP-M')
    expect(t['Multa e juros']).toBe('2% + 1% ao mês')
    expect(t['IPTU']).toBe('não reembolsável')
  })
  it('fmtPct', () => expect(fmtPct(4.5)).toBe('4,5'))
})
