"use server"

import { revalidatePath } from 'next/cache'
import { inviteMember, removeMember, updateMemberRole, cancelInvite } from '@/lib/go/organization'

export async function handleInviteMember(formData: FormData) {
  const email = formData.get('email') as string
  const role = formData.get('role') as string
  
  if (!email || !role) return { error: 'Email e perfil são obrigatórios' }
  
  try {
    await inviteMember(email, role)
    revalidatePath('/settings/team')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'Erro ao convidar membro' }
  }
}

export async function handleRemoveMember(memberId: string) {
  try {
    await removeMember(memberId)
    revalidatePath('/settings/team')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'Erro ao remover membro' }
  }
}

export async function handleUpdateRole(memberId: string, role: string) {
  try {
    await updateMemberRole(memberId, role)
    revalidatePath('/settings/team')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'Erro ao atualizar perfil' }
  }
}

export async function handleCancelInvite(inviteId: string) {
  try {
    await cancelInvite(inviteId)
    revalidatePath('/settings/team')
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'Erro ao cancelar convite' }
  }
}
