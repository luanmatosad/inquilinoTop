import { describe, it, expect } from 'vitest'
import {
  leaseSchema,
  renewSchema,
  readjustSchema,
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
      deposit_amount: '',
      generate_payments: true,
      iptu_reimbursable: false,
      notes: '',
    })
    expect(p.start_date).toBe('2026-01-01T00:00:00Z')
    expect(p.end_date).toBe('2026-12-31T00:00:00Z')
    expect(p.rent_amount).toBe(1500.5)
    expect(p.payment_day).toBe(5)
    expect(p.deposit_amount).toBeUndefined()
    expect(p.notes).toBeUndefined()
    expect(p.generate_payments).toBe(true)
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
    for (const v of ['0', '-1', '100,01', 'x', '']) {
      expect(readjustSchema.safeParse({ percentage: v, applied_at: '2026-06-01' }).success).toBe(false)
    }
    expect(readjustSchema.safeParse({ percentage: '5,5', applied_at: '2026-06-01' }).success).toBe(true)
  })
  it('payload envia fração (5% -> 0.05)', () => {
    const p = toReadjustPayload({ percentage: '5', applied_at: '2026-06-01', index_name: 'IGPM', notes: '' })
    expect(p.percentage).toBeCloseTo(0.05, 10)
    expect(p.applied_at).toBe('2026-06-01T00:00:00Z')
    expect(p.index_name).toBe('IGPM')
    expect(p.notes).toBeUndefined()
  })
})
