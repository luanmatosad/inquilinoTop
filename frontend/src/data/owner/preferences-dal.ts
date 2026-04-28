import { goFetch } from '@/lib/go/server-auth'

export interface OwnerSettings {
  user_id: string
  notify_payment_overdue: boolean
  notify_lease_expiring: boolean
  notify_lease_expiring_days: number
  notify_new_message: boolean
  notify_maintenance_request: boolean
  notify_payment_received: boolean
  created_at: string
  updated_at: string
}

export interface UpdateOwnerSettingsInput {
  notify_payment_overdue?: boolean
  notify_lease_expiring?: boolean
  notify_lease_expiring_days?: number
  notify_new_message?: boolean
  notify_maintenance_request?: boolean
  notify_payment_received?: boolean
}

export async function getOwnerSettings(): Promise<OwnerSettings | null> {
  try {
    return await goFetch<OwnerSettings>('/api/v1/auth/notification-preferences')
  } catch {
    return null
  }
}

export async function upsertOwnerSettings(input: UpdateOwnerSettingsInput): Promise<OwnerSettings> {
  return goFetch<OwnerSettings>('/api/v1/auth/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
