import { goFetch } from '@/lib/go/server-auth'

export interface Property {
  id: string
  owner_id: string
  type: 'RESIDENTIAL' | 'SINGLE'
  name: string
  address_line: string | null
  city: string | null
  state: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PropertyWithUnits extends Property {
  units: { id: string; label?: string }[]
}

export async function listProperties(): Promise<PropertyWithUnits[]> {
  try {
    const data = await goFetch<PropertyWithUnits[]>('/api/v1/properties')
    return data ?? []
  } catch {
    return []
  }
}

export async function getProperty(id: string): Promise<Property | null> {
  try {
    return await goFetch<Property>(`/api/v1/properties/${id}`)
  } catch {
    return null
  }
}

export interface CreatePropertyInput {
  type: 'RESIDENTIAL' | 'SINGLE'
  name: string
  address_line?: string
  city?: string
  state?: string
}

export async function createProperty(input: CreatePropertyInput): Promise<Property> {
  return goFetch<Property>('/api/v1/properties', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface UpdatePropertyInput {
  name?: string
  address_line?: string
  city?: string
  state?: string
  is_active?: boolean
}

export async function updateProperty(id: string, input: UpdatePropertyInput): Promise<Property> {
  return goFetch<Property>(`/api/v1/properties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
