import { describe, it, expect } from 'vitest'
import { mapDashboardMetrics, classifyDashboardError, type DashboardMetricsResponse } from '@/data/dashboard/mapper'

const response: DashboardMetricsResponse = {
  total_properties: 3,
  total_units: 10,
  occupied_units: 7,
  vacancy_rate: 30,
  total_tenants: 6,
  monthly_revenue: { total: 1000, paid: 600, pending: 300, overdue: 100 },
  recent_payments: [
    { id: 'p1', description: 'Aluguel', amount: 500, due_date: '2026-10-05', status: 'LATE', tenant_name: 'Ana' },
  ],
  expiring_leases: [{ id: 'l1', unit_label: 'Apto 1', tenant_name: 'Bia', end_date: '2026-11-10' }],
}

describe('mapDashboardMetrics', () => {
  it('maps snake_case to camelCase', () => {
    expect(mapDashboardMetrics(response)).toEqual({
      totalProperties: 3,
      totalUnits: 10,
      occupiedUnits: 7,
      vacancyRate: 30,
      totalTenants: 6,
      monthlyRevenue: { total: 1000, paid: 600, pending: 300, overdue: 100 },
      recentPayments: [
        { id: 'p1', description: 'Aluguel', amount: 500, due_date: '2026-10-05', status: 'LATE', tenantName: 'Ana' },
      ],
      expiringLeases: [{ id: 'l1', unitLabel: 'Apto 1', tenantName: 'Bia', endDate: '2026-11-10' }],
    })
  })

  it('tolerates null lists', () => {
    const m = mapDashboardMetrics({ ...response, recent_payments: null, expiring_leases: null } as never)
    expect(m.recentPayments).toEqual([])
    expect(m.expiringLeases).toEqual([])
  })
})

describe('classifyDashboardError', () => {
  it('classifies by status/code', () => {
    expect(classifyDashboardError(new Error('UNAUTHORIZED'))).toBe('unauthorized')
    expect(classifyDashboardError(Object.assign(new Error('x'), { status: 401, code: 'NO_ORG' }))).toBe('no_org')
    expect(classifyDashboardError(Object.assign(new Error('x'), { status: 403, code: 'FORBIDDEN' }))).toBe('forbidden')
    expect(classifyDashboardError(Object.assign(new Error('x'), { status: 500, code: 'METRICS_FAILED' }))).toBe('server')
    expect(classifyDashboardError(new Error('boom'))).toBe('server')
  })
})
