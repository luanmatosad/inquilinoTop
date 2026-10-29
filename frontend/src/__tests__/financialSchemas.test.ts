import { describe, it, expect } from 'vitest'
import {
  payExpenseSchema,
  payReceivableSchema,
  toPayExpensePayload,
  parseFilters,
  toQuery,
} from '@/lib/financial-schemas'

describe('payExpenseSchema', () => {
  it('exige a data de pagamento', () => {
    expect(payExpenseSchema.safeParse({}).success).toBe(false)
    expect(payExpenseSchema.safeParse({ paid_date: '15/06/2026' }).success).toBe(false)
    expect(payExpenseSchema.safeParse({ paid_date: '2026-06-15' }).success).toBe(true)
  })
  it('valor é opcional, mas deve ser positivo quando informado', () => {
    expect(payExpenseSchema.safeParse({ paid_date: '2026-06-15', paid_amount: '' }).success).toBe(true)
    expect(payExpenseSchema.safeParse({ paid_date: '2026-06-15', paid_amount: '149,99' }).success).toBe(true)
    for (const v of ['0', '-1', 'abc']) {
      expect(payExpenseSchema.safeParse({ paid_date: '2026-06-15', paid_amount: v }).success).toBe(false)
    }
  })
  it('payload usa RFC3339 e omite valor vazio', () => {
    expect(toPayExpensePayload({ paid_date: '2026-06-15', paid_amount: '' })).toEqual({ paid_date: '2026-06-15T00:00:00Z' })
    expect(toPayExpensePayload({ paid_date: '2026-06-15', paid_amount: '149,99' })).toEqual({
      paid_date: '2026-06-15T00:00:00Z',
      paid_amount: 149.99,
    })
  })
})

describe('payReceivableSchema', () => {
  it('exige a data', () => {
    expect(payReceivableSchema.safeParse({ paid_date: '' }).success).toBe(false)
    expect(payReceivableSchema.safeParse({ paid_date: '2026-06-15' }).success).toBe(true)
  })
})

describe('filtros', () => {
  const id = '5f0b6c1e-4f4a-4b5c-8e0a-1f2d3c4b5a69'
  it('ignora valores inválidos', () => {
    expect(parseFilters({ status: 'XYZ', from: 'ontem', to: '2026-13', ref: 'abc' })).toEqual({ to: undefined })
  })
  it('aceita valores válidos', () => {
    expect(parseFilters({ status: 'LATE', from: '2026-06-01', to: '2026-06-30', ref: id })).toEqual({
      status: 'LATE',
      from: '2026-06-01',
      to: '2026-06-30',
      ref: id,
    })
  })
  it('monta a query do backend com o parâmetro certo', () => {
    const f = { status: 'PENDING' as const, from: '2026-06-01', ref: id }
    expect(toQuery(f, 'unit_id')).toBe(`?status=PENDING&from=2026-06-01&unit_id=${id}`)
    expect(toQuery(f, 'lease_id', { withStatus: false })).toBe(`?from=2026-06-01&lease_id=${id}`)
    expect(toQuery({}, 'unit_id')).toBe('')
  })
})
