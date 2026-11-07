import { describe, it, expect } from 'vitest'
import { preserveLeaseFields, previewReadjustment } from '@/lib/lease-form'
import { formatMonthYear } from '@/lib/date-format'

describe('previewReadjustment', () => {
  it('1550 +4,5% = 1619,75 (+69,75)', () => {
    expect(previewReadjustment(1550, 4.5)).toEqual({ newAmount: 1619.75, increase: 69.75 })
  })
  it('percentual inválido não altera', () => {
    expect(previewReadjustment(1000, NaN)).toEqual({ newAmount: 1000, increase: 0 })
  })
})

describe('formatMonthYear', () => {
  it('MM/AAAA', () => {
    expect(formatMonthYear('2027-03-01T00:00:00Z')).toBe('03/2027')
    expect(formatMonthYear(null)).toBe('—')
  })
})

describe('preserveLeaseFields', () => {
  const current = { deposit_amount: 3000, iptu_year: 2026, annual_iptu_amount: 1200, status: 'ACTIVE' }
  it('caução, ano do IPTU e status voltam do atual', () => {
    const r = preserveLeaseFields(current, { iptu_reimbursable: true, annual_iptu_amount: 900 })
    expect(r.deposit_amount).toBe(3000)
    expect(r.iptu_year).toBe(2026)
    expect(r.status).toBe('ACTIVE')
    expect(r.annual_iptu_amount).toBe(900)
  })
  it('sem reembolso de IPTU mantém o valor anual atual', () => {
    const r = preserveLeaseFields(current, { iptu_reimbursable: false, annual_iptu_amount: undefined })
    expect(r.annual_iptu_amount).toBe(1200)
  })
})
