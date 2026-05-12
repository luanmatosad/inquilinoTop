// Definições de Tipos Compartilhados

export interface Property {
  id: string
  owner_id: string
  type: 'RESIDENTIAL' | 'SINGLE'
  name: string
  address_line?: string | null
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
  is_active: boolean
  created_at: string
}

export interface Tenant {
  id: string
  owner_id: string
  name: string
  email?: string | null
  phone?: string | null
  document?: string | null
  is_active: boolean
  created_at: string
}

export interface Lease {
  id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date?: string | null
  rent_amount: number
  payment_day: number
  status: 'ACTIVE' | 'ENDED' | 'CANCELED'
  notes?: string | null
  created_at: string
}

export interface Payment {
  id: string
  lease_id: string
  description: string
  amount: number
  due_date: string
  paid_at?: string | null
  status: 'PENDING' | 'PAID' | 'LATE'
  type: 'RENT' | 'DEPOSIT' | 'EXPENSE' | 'OTHER'
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
  user_id: string
  full_name?: string | null
  document?: string | null
  person_type?: 'PF' | 'PJ' | null
  phone?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  created_at: string
  updated_at: string
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

export interface BankInfo {
  bank_code: string
  agency: string
  account: string
  account_type: 'CC' | 'CP'
  owner_name: string
  document: string
}

export interface FinancialConfig {
  id: string
  owner_id: string
  provider: 'ASAAS' | 'BRADESCO' | 'ITAU' | 'SICOOB' | 'MOCK'
  config?: Record<string, unknown>
  pix_key?: string | null
  bank_info?: BankInfo | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UpsertFinancialConfigInput {
  provider: string
  config: Record<string, unknown>
  pix_key?: string | null
  bank_info?: BankInfo | null
}
