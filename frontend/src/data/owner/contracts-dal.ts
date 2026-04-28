import { goFetch } from '@/lib/go/server-auth'

export interface Lease {
  id: string
  owner_id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date: string | null
  rent_amount: number
  payment_day: number
  status: 'ACTIVE' | 'ENDED' | 'CANCELED'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LeaseWithDetails extends Lease {
  units: { id: string; property_id: string; label: string } | null
  tenants: { id: string; name: string } | null
}

export async function listLeases(): Promise<LeaseWithDetails[]> {
  try {
    const data = await goFetch<Lease[]>('/api/v1/leases')
    return (data ?? []) as LeaseWithDetails[]
  } catch {
    return []
  }
}

export async function getLease(id: string): Promise<Lease | null> {
  try {
    return await goFetch<Lease>(`/api/v1/leases/${id}`)
  } catch {
    return null
  }
}

export interface CreateLeaseInput {
  unit_id: string
  tenant_id: string
  start_date: string
  end_date?: string
  rent_amount: number
  payment_day: number
  notes?: string
}

export async function createLease(input: CreateLeaseInput): Promise<Lease> {
  return goFetch<Lease>('/api/v1/leases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface UpdateLeaseInput {
  start_date?: string
  end_date?: string
  rent_amount?: number
  payment_day?: number
  status?: 'ACTIVE' | 'ENDED' | 'CANCELED'
  notes?: string
}

export async function updateLease(id: string, input: UpdateLeaseInput): Promise<Lease> {
  return goFetch<Lease>(`/api/v1/leases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function endLease(id: string): Promise<Lease> {
  return goFetch<Lease>(`/api/v1/leases/${id}/end`, { method: 'POST' })
}

export async function getActiveLeaseForUnit(unitId: string): Promise<Lease | null> {
  try {
    const leases = await goFetch<Lease[]>('/api/v1/leases')
    return (leases ?? []).find(l => l.unit_id === unitId && l.status === 'ACTIVE') ?? null
  } catch {
    return null
  }
}
