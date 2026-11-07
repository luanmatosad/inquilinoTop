import { describe, it, expect } from 'vitest'
import {
  leaseSchema,
  renewSchema,
  readjustSchema,
  endSchema,
  toEndPayload,
  toLeasePayload,
  toRenewPayload,
  toReadjustPayload,
} from '@/lib/lease-schemas'

const UNIT = '5f0b6c1e-4f4a-4b5c-8e0a-1f2d3c4b5a69'
const TENANT = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const base = { unit_id: UNIT, tenant_id: TENANT, start_date: '2026-01-01', rent_amount: '1500', payment_day: '5' }

describe('leaseSchema', () => {
  it('aceita o mínimo obrigatório', () => {
    expect(leaseSchema.safeParse(base).success).toBe(true)
  })
  it('exige unidade e inquilino', () => {
    expect(leaseSchema.safeParse({ ...base, unit_id: '' }).success).toBe(false)
    expect(leaseSchema.safeParse({ ...base, tenant_id: '' }).success).toBe(false)
  })
  it('fim precisa ser posterior ao início', () => {
    const r = leaseSchema.safeParse({ ...base, end_date: '2026-01-01' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.end_date).toBeTruthy()
    expect(leaseSchema.safeParse({ ...base, end_date: '2026-12-31' }).success).toBe(true)
  })
  it('aluguel deve ser maior que zero', () => {
    for (const v of ['0', '-1', 'abc', '']) {
      expect(leaseSchema.safeParse({ ...base, rent_amount: v }).success).toBe(false)
    }
    expect(leaseSchema.safeParse({ ...base, rent_amount: '1.500,50' }).success).toBe(false)
    expect(leaseSchema.safeParse({ ...base, rent_amount: '1500,50' }).success).toBe(true)
  })
  it('dia de vencimento entre 1 e 31', () => {
    for (const v of ['0', '32', '1.5', '']) {
      expect(leaseSchema.safeParse({ ...base, payment_day: v }).success).toBe(false)
    }
  })
  it('observações até 2000 caracteres', () => {
    expect(leaseSchema.safeParse({ ...base, notes: 'a'.repeat(2000) }).success).toBe(true)
    expect(leaseSchema.safeParse({ ...base, notes: 'a'.repeat(2001) }).success).toBe(false)
  })
  it('payload usa RFC3339, números e omite vazios', () => {
    const p = toLeasePayload({
      ...base,
      end_date: '2026-12-31',
      rent_amount: '1500,50',
      generate_payments: true,
      iptu_reimbursable: false,
      notes: '',
    })
    expect(p.start_date).toBe('2026-01-01T00:00:00Z')
    expect(p.end_date).toBe('2026-12-31T00:00:00Z')
    expect(p.rent_amount).toBe(1500.5)
    expect(p.payment_day).toBe(5)
    expect(p.adjustment_index).toBeUndefined()
    expect(p.notes).toBeUndefined()
    expect(p.generate_payments).toBe(true)
  })
})

describe('leaseSchema: reajuste e juros', () => {
  it('índice só IGP-M ou IPCA; mês 1 a 12', () => {
    expect(leaseSchema.safeParse({ ...base, adjustment_index: 'IGP-M', adjustment_month: '3' }).success).toBe(true)
    expect(leaseSchema.safeParse({ ...base, adjustment_index: 'XYZ' }).success).toBe(false)
    for (const m of ['0', '13', 'a']) expect(leaseSchema.safeParse({ ...base, adjustment_month: m }).success).toBe(false)
  })
  it('juros ao mês viram diário no payload', () => {
    const p = toLeasePayload({ ...base, adjustment_index: 'IPCA', adjustment_month: '3', monthly_interest_percent: '1', late_fee_percent: '2' })
    expect(p.daily_interest_percent).toBe(0.033333)
    expect(p.late_fee_percent).toBe(2)
    expect(p.adjustment_index).toBe('IPCA')
    expect(p.adjustment_month).toBe(3)
  })
})

describe('endSchema', () => {
  it('exige data e motivo válido', () => {
    expect(endSchema.safeParse({ end_date: '2026-11-30' }).success).toBe(false)
    expect(endSchema.safeParse({ end_date: '2026-11-30', reason: 'XX' }).success).toBe(false)
    const ok = endSchema.safeParse({ end_date: '2026-11-30', reason: 'TENANT_REQUEST' })
    expect(ok.success).toBe(true)
    if (ok.success) expect(toEndPayload(ok.data)).toEqual({ end_date: '2026-11-30', reason: 'TENANT_REQUEST' })
  })
})

describe('renewSchema', () => {
  it('exige nova data final', () => {
    expect(renewSchema.safeParse({}).success).toBe(false)
    expect(renewSchema.safeParse({ new_end_date: '2027-12-31' }).success).toBe(true)
  })
  it('payload converte data e valor opcional', () => {
    const p = toRenewPayload({ new_end_date: '2027-12-31', rent_amount: '1700', payment_day: '' })
    expect(p).toEqual({ new_end_date: '2027-12-31T00:00:00Z', rent_amount: 1700 })
  })
})

describe('readjustSchema', () => {
  it('percentual em % entre 0 (exclusivo) e 100', () => {
    for (const v of ['0', '0,09', '-1', '100,01', 'x', '']) {
      expect(readjustSchema.safeParse({ percentage: v, applied_at: '2026-06-01' }).success).toBe(false)
    }
    expect(readjustSchema.safeParse({ percentage: '5,5', applied_at: '2026-06-01' }).success).toBe(true)
  })
  it('payload envia fração (5% -> 0.05)', () => {
    const p = toReadjustPayload({ percentage: '5', applied_at: '2026-06-01', index_name: 'IGP-M', notes: '' })
    expect(p.percentage).toBeCloseTo(0.05, 10)
    expect(p.applied_at).toBe('2026-06-01T00:00:00Z')
    expect(p.index_name).toBe('IGP-M')
    expect(p.notes).toBeUndefined()
  })
})
