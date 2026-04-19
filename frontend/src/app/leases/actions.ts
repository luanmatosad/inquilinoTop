'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { generateInitialPayments } from '@/app/payments/actions'

const leaseSchema = z.object({
  unit_id: z.string().uuid(),
  tenant_id: z.string().uuid({ message: 'Selecione um inquilino.' }),
  start_date: z.string().min(1, { message: 'Data de início obrigatória.' }),
  end_date: z.string().optional().or(z.literal('')),
  rent_amount: z.coerce.number().min(0.01, { message: 'Valor do aluguel deve ser maior que zero.' }),
  payment_day: z.coerce.number().min(1).max(31, { message: 'Dia de vencimento deve ser entre 1 e 31.' }),
  notes: z.string().optional(),
})

export type LeaseActionState = {
  error?: string
  success?: string
  fieldErrors?: {
    [key: string]: string[]
  }
} | null

export async function createLease(prevState: LeaseActionState, formData: FormData) {
  const rawData = {
    unit_id: formData.get('unit_id'),
    tenant_id: formData.get('tenant_id'),
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    rent_amount: formData.get('rent_amount'),
    payment_day: formData.get('payment_day'),
    notes: formData.get('notes'),
  }

  const validatedFields = leaseSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: 'Erro de validação. Verifique os campos.',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  // Verificar se já existe contrato ativo para esta unidade
  const { data: activeLease } = await supabase
    .from('leases')
    .select('id')
    .eq('unit_id', validatedFields.data.unit_id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (activeLease) {
    return {
      error: 'Esta unidade já possui um contrato ativo. Encerre-o antes de criar um novo.',
    }
  }

  const { data: newLease, error } = await supabase.from('leases').insert({
    unit_id: validatedFields.data.unit_id,
    tenant_id: validatedFields.data.tenant_id,
    start_date: validatedFields.data.start_date,
    end_date: validatedFields.data.end_date || null,
    rent_amount: validatedFields.data.rent_amount,
    payment_day: validatedFields.data.payment_day,
    notes: validatedFields.data.notes || null,
    status: 'ACTIVE',
  }).select('id').single()

  if (error) {
    return {
      error: 'Erro ao criar contrato: ' + error.message,
    }
  }

  // Gerar pagamentos iniciais
  if (newLease) {
      await generateInitialPayments(
        newLease.id, 
        validatedFields.data.start_date as string, 
        Number(validatedFields.data.rent_amount), 
        Number(validatedFields.data.payment_day)
      )
  }

  revalidatePath(`/units/${validatedFields.data.unit_id}`)
  revalidatePath(`/properties`) // Revalidar propriedades caso mostre status lá
  
  return { success: 'Contrato criado com sucesso!' }
}

export async function endLease(id: string, unitId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('leases')
    .update({ status: 'ENDED', end_date: new Date().toISOString().split('T')[0] }) // Define data de fim como hoje
    .eq('id', id)

  if (error) {
    return { error: 'Erro ao encerrar contrato: ' + error.message }
  }

  revalidatePath(`/units/${unitId}`)
  return { success: true }
}

export async function cancelLease(id: string, unitId: string) {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('leases')
      .update({ status: 'CANCELED' })
      .eq('id', id)
  
    if (error) {
      return { error: 'Erro ao cancelar contrato: ' + error.message }
    }
  
    revalidatePath(`/units/${unitId}`)
    return { success: true }
  }

// Função auxiliar para buscar tenants para o select (pode ser chamada no server component)
export async function getActiveTenants() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('tenants')
        .select('id, name, document')
        .eq('is_active', true)
        .order('name')
    
    return data || []
}
