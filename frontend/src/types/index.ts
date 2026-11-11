// Definições de Tipos Compartilhados

export interface Property {
  id: string
  owner_id: string
  type: 'RESIDENTIAL' | 'COMMERCIAL' | 'SINGLE'
  name: string
  address_line?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  postal_code?: string | null
  city?: string | null
  state?: string | null
  is_active: boolean
  created_at: string
}

export interface Unit {
  id: string
  property_id: string
  label: string
  floor?: string | null
  notes?: string | null
  area_m2?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  is_active: boolean
  created_at: string
}

export interface Expense {
  id: string
  unit_id: string
  description: string
  category: 'ELECTRICITY' | 'WATER' | 'CONDO' | 'TAX' | 'MAINTENANCE' | 'OTHER'
  amount: number
  due_date: string
  paid_at?: string | null
  status: 'PENDING' | 'PAID'
  notes?: string | null
  created_at: string
}

export interface UserProfile {
  user_id?: string
  /** E-mail de acesso (somente leitura) e estado do 2FA, devolvidos junto com o perfil. */
  email?: string
  two_factor_enabled?: boolean
  full_name?: string | null
  document?: string | null
  person_type?: 'PF' | 'PJ' | null
  phone?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  created_at?: string
  updated_at?: string
}

export interface UpsertProfileInput {
  full_name?: string | null
  document?: string | null
  person_type?: 'PF' | 'PJ' | null
  phone?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
}
