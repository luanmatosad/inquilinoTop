'use server'

import { revalidatePath } from 'next/cache'
import { goFetch } from '@/lib/go/server-auth'
import { UserProfile, UpsertProfileInput } from '@/types'

export async function getProfile(): Promise<UserProfile | null> {
  try {
    const data = await goFetch<UserProfile | null>('/api/v1/auth/profile')
    return data
  } catch (error) {
    console.error('Error fetching profile:', error)
    return null
  }
}

export async function updateProfile(prevState: unknown, formData: FormData) {
  try {
    const input: UpsertProfileInput = {
      full_name: (formData.get('full_name') as string) || null,
      document: (formData.get('document') as string) || null,
      person_type: (formData.get('person_type') as 'PF' | 'PJ') || null,
      phone: (formData.get('phone') as string) || null,
      address_line: (formData.get('address_line') as string) || null,
      city: (formData.get('city') as string) || null,
      state: (formData.get('state') as string) || null,
    }

    const data = await goFetch<UserProfile>('/api/v1/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(input),
    })

    revalidatePath('/settings/profile')
    revalidatePath('/', 'layout')

    return { success: 'Perfil atualizado com sucesso!', profile: data }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { error: error instanceof Error ? error.message : 'Erro ao atualizar perfil.' }
  }
}
