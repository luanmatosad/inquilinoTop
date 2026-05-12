import { goFetch } from "@/lib/go/client"

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

interface Property {
  id: string
  units: { id: string }[]
}

interface Unit {
  id: string
  property_id: string
  is_active: boolean
}

interface Tenant {
  id: string
}

interface Lease {
  id: string
  unit_id: string
  tenant_id: string
  end_date: string
  status: string
  units?: { label: string }
  tenants?: { name: string }
}

interface Payment {
  id: string
  lease_id: string
  due_date: string
  paid_date?: string
  status: string
  gross_amount: number
  description?: string
  leases?: { tenants?: { name: string } }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const properties: Property[] = []
  const units: Unit[] = []
  const tenants: Tenant[] = []
  const payments: Payment[] = []
  const expiringLeases: Lease[] = []

  try {
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    ;[properties, units, tenants] = await Promise.all([
      goFetch<Property[]>("/api/v1/properties", {}),
      goFetch<Property[]>("/api/v1/properties", {}).then((props) =>
        Promise.all(props.map((p) => goFetch<Unit[]>(`/api/v1/properties/${p.id}/units`, {})))
      ).then((unitArrays) => unitArrays.flat()),
      goFetch<Tenant[]>("/api/v1/tenants", {}),
    ])
  } catch (error) {
    console.error("Error fetching dashboard:", error)
  }

  const totalProperties = properties.length
  const totalUnits = units.length

  const vacancyRate = totalUnits > 0 ? ((totalUnits - 0) / totalUnits) * 100 : 0

  const monthlyRevenue = {
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
  }

  const today = new Date().toISOString().split("T")[0]

  const recentPayments: DashboardMetrics["recentPayments"] = []
  const formattedExpiringLeases: DashboardMetrics["expiringLeases"] = []

  return {
    totalProperties,
    totalUnits,
    occupiedUnits: 0,
    vacancyRate,
    totalTenants: tenants.length,
    monthlyRevenue,
    recentPayments,
    expiringLeases: formattedExpiringLeases,
  }
}