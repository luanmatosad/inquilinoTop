import { describe, it, expect } from 'vitest'
import {
  buildLeaseRows,
  buildLeaseIndicators,
  isReadjustmentPending,
  todaySaoPaulo,
  type OverviewLeaseItem,
} from '@/lib/lease-overview'

const NOW = new Date('2026-11-06T15:00:00Z') // 06/11/2026 em São Paulo
const lease = (o: Partial<OverviewLeaseItem> = {}): OverviewLeaseItem => ({
  id: 'l1', tenant_id: 't1', unit_id: 'u1', status: 'ACTIVE', start_date: '2025-01-01T00:00:00Z',
  rent_amount: 1000, ...o,
})
const plus = (days: number) => new Date(Date.UTC(2026, 10, 6 + days)).toISOString()

describe('buildLeaseRows', () => {
  const tenants = [{ id: 't1', name: 'Marina Souza' }]
  const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Apartamento 302' }] }]
  it('linha completa', () => {
    const [r] = buildLeaseRows({ leases: [lease()], tenants, properties })
    expect(r.tenantName).toBe('Marina Souza')
    expect(r.unitLabel).toBe('Apartamento 302')
    expect(r.propertyName).toBe('Ed. Aurora')
  })
  it('unidade ausente', () => {
    const [r] = buildLeaseRows({ leases: [lease({ unit_id: 'x' })], tenants, properties })
    expect(r.unitLabel).toBe('—')
    expect(r.propertyName).toBe('—')
  })
  it('inquilino ausente', () => {
    const [r] = buildLeaseRows({ leases: [lease({ tenant_id: 'x' })], tenants, properties })
    expect(r.tenantName).toBe('—')
  })
  it('units nulo não quebra', () => {
    const [r] = buildLeaseRows({ leases: [lease()], tenants, properties: [{ id: 'p1', name: 'A', units: null }] })
    expect(r.unitLabel).toBe('—')
  })
})

describe('buildLeaseIndicators', () => {
  it('soma do aluguel dos ativos', () => {
    const ls = [1850, 1600, 1550, 2200, 1100].map((rent_amount, i) => lease({ id: `l${i}`, rent_amount }))
    const k = buildLeaseIndicators(ls, NOW)
    expect(k.activeCount).toBe(5)
    expect(k.activeRent).toBe(8300)
  })
  it('encerrados e cancelados', () => {
    const k = buildLeaseIndicators([lease({ status: 'ENDED' }), lease({ status: 'CANCELED' })], NOW)
    expect(k.activeCount).toBe(0)
    expect(k.endedCount).toBe(1)
  })
  it('fronteira dos 30 dias', () => {
    expect(buildLeaseIndicators([lease({ end_date: plus(30) })], NOW).expiring30).toBe(1)
    expect(buildLeaseIndicators([lease({ end_date: plus(31) })], NOW).expiring30).toBe(0)
  })
  it('contrato aberto não vence', () => {
    expect(buildLeaseIndicators([lease({ end_date: null })], NOW).expiring30).toBe(0)
  })
  it('reajuste do mês corrente conta e não é pendente', () => {
    const l = lease({ next_readjustment: '2026-11-01T00:00:00Z' })
    expect(buildLeaseIndicators([l], NOW).readjust90).toBe(1)
    expect(isReadjustmentPending(l, NOW)).toBe(false)
  })
  it('reajuste de mês anterior é pendente e não conta', () => {
    const l = lease({ next_readjustment: '2026-10-01T00:00:00Z' })
    expect(buildLeaseIndicators([l], NOW).readjust90).toBe(0)
    expect(isReadjustmentPending(l, NOW)).toBe(true)
  })
  it('fronteira dos 90 dias', () => {
    expect(buildLeaseIndicators([lease({ next_readjustment: plus(90) })], NOW).readjust90).toBe(1)
    expect(buildLeaseIndicators([lease({ next_readjustment: plus(91) })], NOW).readjust90).toBe(0)
  })
  it('sem next_readjustment ou inativo: nunca pendente', () => {
    expect(isReadjustmentPending(lease(), NOW)).toBe(false)
    expect(isReadjustmentPending(lease({ status: 'ENDED', next_readjustment: '2020-01-01T00:00:00Z' }), NOW)).toBe(false)
  })
  it('virada do mês em São Paulo', () => {
    const late = new Date('2026-12-01T02:00:00Z') // 30/11 23h em SP
    expect(todaySaoPaulo(late)).toBe('2026-11-30')
  })
})
