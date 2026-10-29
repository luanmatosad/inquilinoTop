export interface DashboardMetrics {
  totalProperties: number
  totalUnits: number
  occupiedUnits: number
  vacancyRate: number
  totalTenants: number
  monthlyRevenue: {
    total: number
    paid: number
    pending: number
    overdue: number
  }
  recentPayments: {
    id: string
    description: string
    amount: number
    due_date: string
    status: string
    tenantName: string
  }[]
  expiringLeases: {
    id: string
    unitLabel: string
    tenantName: string
    endDate: string
  }[]
}

// Contract of GET /api/v1/dashboard/metrics (after goFetch unwraps the envelope).
export interface DashboardMetricsResponse {
  total_properties: number
  total_units: number
  occupied_units: number
  vacancy_rate: number
  total_tenants: number
  monthly_revenue: { total: number; paid: number; pending: number; overdue: number }
  recent_payments: {
    id: string
    description: string
    amount: number
    due_date: string
    status: 'PENDING' | 'PAID' | 'LATE'
    tenant_name: string
  }[]
  expiring_leases: { id: string; unit_label: string; tenant_name: string; end_date: string }[]
}

export function mapDashboardMetrics(r: DashboardMetricsResponse): DashboardMetrics {
  return {
    totalProperties: r.total_properties,
    totalUnits: r.total_units,
    occupiedUnits: r.occupied_units,
    vacancyRate: r.vacancy_rate,
    totalTenants: r.total_tenants,
    monthlyRevenue: { ...r.monthly_revenue },
    recentPayments: (r.recent_payments ?? []).map((p) => ({
      id: p.id,
      description: p.description,
      amount: p.amount,
      due_date: p.due_date,
      status: p.status,
      tenantName: p.tenant_name,
    })),
    expiringLeases: (r.expiring_leases ?? []).map((l) => ({
      id: l.id,
      unitLabel: l.unit_label,
      tenantName: l.tenant_name,
      endDate: l.end_date,
    })),
  }
}

export type DashboardErrorKind = 'unauthorized' | 'no_org' | 'forbidden' | 'server'

export function classifyDashboardError(error: unknown): DashboardErrorKind {
  if (error instanceof Error && error.message === 'UNAUTHORIZED') return 'unauthorized'
  const { status, code } = (error ?? {}) as { status?: number; code?: string }
  if (status === 401 && code === 'NO_ORG') return 'no_org'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  return 'server'
}
