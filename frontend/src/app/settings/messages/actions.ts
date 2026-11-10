'use server'

import { revalidatePath } from 'next/cache'

import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import { validateReminders, type Reminder } from '@/lib/message-templates'

export type SaveRemindersResult = { success: true; reminders: Reminder[] } | { error: string }

/** Grava a lista inteira de lembretes (valida no servidor, com as mesmas regras do backend). Só o dono grava. */
export async function saveReminders(list: Reminder[]): Promise<SaveRemindersResult> {
  const problem = validateReminders(list)
  if (problem) return { error: problem }
  try {
    const res = await goFetch<{ reminders: Reminder[] }>('/api/v1/settings/reminders', { method: 'PUT', body: JSON.stringify({ reminders: list }) })
    revalidatePath('/settings/messages')
    revalidatePath('/financial/receivables')
    return { success: true, reminders: res.reminders }
  } catch (error) {
    const { code, status, message } = goErrorInfo(error)
    if (status === 403) return { error: 'Só o dono da conta pode alterar as mensagens.' }
    if (code === 'INVALID_REMINDERS' && message) return { error: message.charAt(0).toUpperCase() + message.slice(1) + '.' }
    console.error('Erro ao salvar os lembretes:', error)
    return { error: 'Erro ao salvar as mensagens.' }
  }
}
