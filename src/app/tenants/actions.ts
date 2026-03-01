'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const tenantSchema = z.object({
  name: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' }),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
  phone: z.string().optional(),
  document: z.string().optional(),
})

export type TenantActionState = {
  error?: string
  success?: string
  fieldErrors?: {
    [key: string]: string[]
  }
} | null

export async function createTenant(prevState: TenantActionState, formData: FormData) {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    document: formData.get('document'),
  }

  const validatedFields = tenantSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: 'Erro de validação. Verifique os campos.',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()
  
  // Obter o usuário atual explicitamente para garantir que o owner_id seja passado
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Usuário não autenticado.' }
  }

  const { error } = await supabase.from('tenants').insert({
    name: validatedFields.data.name,
    email: validatedFields.data.email || null,
    phone: validatedFields.data.phone || null,
    document: validatedFields.data.document || null,
    owner_id: user.id // Forçar o envio do owner_id
  })

  if (error) {
    return {
      error: 'Erro ao criar inquilino: ' + error.message,
    }
  }

  revalidatePath('/tenants')
  return { success: 'Inquilino criado com sucesso!' }
}

export async function updateTenant(id: string, prevState: TenantActionState, formData: FormData) {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    document: formData.get('document'),
  }

  const validatedFields = tenantSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: 'Erro de validação. Verifique os campos.',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update({
      name: validatedFields.data.name,
      email: validatedFields.data.email || null,
      phone: validatedFields.data.phone || null,
      document: validatedFields.data.document || null,
    })
    .eq('id', id)

  if (error) {
    return {
      error: 'Erro ao atualizar inquilino: ' + error.message,
    }
  }

  revalidatePath('/tenants')
  return { success: 'Inquilino atualizado com sucesso!' }
}

export async function deleteTenant(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tenants').delete().eq('id', id)

  if (error) {
    return { error: 'Erro ao excluir inquilino: ' + error.message }
  }

  revalidatePath('/tenants')
  return { success: true }
}

export async function toggleTenantStatus(id: string, isActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    return { error: 'Erro ao atualizar status: ' + error.message }
  }

  revalidatePath('/tenants')
  return { success: true }
}
