import { goFetch } from '@/lib/go/server-auth'

export interface Tenant {
  id: string
  owner_id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  person_type: 'PF' | 'PJ'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TenantWithLeases extends Tenant {
  leases: {
    id: string
    unit_id: string
    start_date: string
    end_date: string | null
    status: string
    rent_amount: number
    payment_day: number
  }[]
}

export async function listTenants(): Promise<Tenant[]> {
  try {
    const data = await goFetch<Tenant[]>('/api/v1/tenants')
    return data ?? []
  } catch {
    return []
  }
}

export async function getTenant(id: string): Promise<Tenant | null> {
  try {
    return await goFetch<Tenant>(`/api/v1/tenants/${id}`)
  } catch {
    return null
  }
}

export interface CreateTenantInput {
  name: string
  person_type: 'PF' | 'PJ'
  email?: string
  phone?: string
  document?: string
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  return goFetch<Tenant>('/api/v1/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface UpdateTenantInput {
  name?: string
  person_type?: 'PF' | 'PJ'
  email?: string
  phone?: string
  document?: string
  is_active?: boolean
}

export async function updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant> {
  return goFetch<Tenant>(`/api/v1/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function getTenantWithLeases(id: string): Promise<TenantWithLeases | null> {
  try {
    return await goFetch<TenantWithLeases>(`/api/v1/tenants/${id}`)
  } catch {
    return null
  }
}
