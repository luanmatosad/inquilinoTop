'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const expenseSchema = z.object({
  unit_id: z.string().uuid(),
  description: z.string().min(3, { message: 'Descrição deve ter no mínimo 3 caracteres.' }),
  category: z.enum(['ELECTRICITY', 'WATER', 'CONDO', 'TAX', 'MAINTENANCE', 'OTHER'], {
    errorMap: () => ({ message: 'Selecione uma categoria válida.' }),
  }),
  amount: z.coerce.number().min(0.01, { message: 'Valor deve ser maior que zero.' }),
  due_date: z.string().min(1, { message: 'Data de vencimento obrigatória.' }),
  notes: z.string().optional(),
})

export type ExpenseActionState = {
  error?: string
  success?: string
  fieldErrors?: {
    [key: string]: string[]
  }
} | null

export async function createExpense(prevState: ExpenseActionState, formData: FormData) {
  const rawData = {
    unit_id: formData.get('unit_id'),
    description: formData.get('description'),
    category: formData.get('category'),
    amount: formData.get('amount'),
    due_date: formData.get('due_date'),
    notes: formData.get('notes'),
  }

  const validatedFields = expenseSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: 'Erro de validação. Verifique os campos.',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('expenses').insert({
    unit_id: validatedFields.data.unit_id,
    description: validatedFields.data.description,
    category: validatedFields.data.category,
    amount: validatedFields.data.amount,
    due_date: validatedFields.data.due_date,
    notes: validatedFields.data.notes || null,
    status: 'PENDING',
  })

  if (error) {
    return {
      error: 'Erro ao criar despesa: ' + error.message,
    }
  }

  revalidatePath(`/units/${validatedFields.data.unit_id}`)
  return { success: 'Despesa registrada com sucesso!' }
}

export async function markExpenseAsPaid(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('expenses')
    .update({ 
      status: 'PAID', 
      paid_at: new Date().toISOString() 
    })
    .eq('id', id)

  if (error) {
    return { error: 'Erro ao marcar como pago: ' + error.message }
  }

  // Como não temos o unit_id aqui facilmente, revalidamos genericamente ou passamos como argumento
  // Para simplificar, o client side pode forçar refresh
  return { success: true }
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: 'Erro ao excluir despesa: ' + error.message }
  }

  return { success: true }
}
