'use server'

import { revalidatePath } from 'next/cache'

import { getOwnerSettings, upsertOwnerSettings } from '@/data/owner/preferences-dal'
import { buildPreferencesPayload } from '@/lib/notification-settings'

export type NotificationsState = { success?: string; error?: string } | null

/** Salva as três preferências da tela. Os campos que a tela não mostra voltam com o valor gravado (o PUT substitui tudo). */
export async function saveNotifications(_prev: NotificationsState, formData: FormData): Promise<NotificationsState> {
  const current = await getOwnerSettings()
  // Sem as preferências atuais não dá para preservar o que a tela esconde: melhor não gravar.
  if (!current) return { error: 'Não foi possível carregar suas preferências. Tente de novo.' }

  const days = formData.get('notify_lease_expiring_days')
  const payload = buildPreferencesPayload(current, {
    paymentReceived: formData.get('notify_payment_received') === 'on',
    paymentOverdue: formData.get('notify_payment_overdue') === 'on',
    leaseExpiring: formData.get('notify_lease_expiring') === 'on',
    leaseExpiringDays: typeof days === 'string' ? days : undefined,
  })
  try {
    await upsertOwnerSettings(payload)
  } catch (error) {
    console.error('Erro ao salvar as preferências de notificação:', error)
    return { error: 'Erro ao salvar as preferências.' }
  }
  revalidatePath('/settings/notifications')
  return { success: 'Preferências salvas.' }
}
