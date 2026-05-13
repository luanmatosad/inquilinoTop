"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { z } from "zod"

const expenseSchema = z.object({
  unit_id: z.string().uuid(),
  description: z.string().min(3, { message: "Descrição deve ter no mínimo 3 caracteres." }),
  category: z.enum(["ELECTRICITY", "WATER", "CONDO", "TAX", "MAINTENANCE", "OTHER"], {
    message: "Selecione uma categoria válida.",
  }),
  amount: z.coerce.number().min(0.01, { message: "Valor deve ser maior que zero." }),
  due_date: z.string().min(1, { message: "Data de vencimento obrigatória." }),
})

export type ExpenseActionState = {
  error?: string
  success?: string
  fieldErrors?: {
    [key: string]: string[]
  }
} | null

interface Expense {
  id: string
  unit_id: string
  description: string
  amount: number
  due_date: string
  category: string
  is_active: boolean
  created_at: string
}

export async function createExpense(prevState: ExpenseActionState, formData: FormData) {
  const rawData = {
    unit_id: formData.get("unit_id"),
    description: formData.get("description"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    due_date: formData.get("due_date"),
  }

  const validatedFields = expenseSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: "Erro de validação. Verifique os campos.",
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    }
  }

  try {
    await goFetch<Expense>(`/api/v1/units/${validatedFields.data.unit_id}/expenses`, {
      method: "POST",
      body: JSON.stringify({
        description: validatedFields.data.description,
        amount: validatedFields.data.amount,
        due_date: `${validatedFields.data.due_date}T00:00:00Z`,
        category: validatedFields.data.category,
      }),
    })

    revalidatePath(`/units/${validatedFields.data.unit_id}`)
    return { success: "Despesa registrada com sucesso!" }
  } catch (error) {
    return {
      error: "Erro ao criar despesa: " + (error instanceof Error ? error.message : "unknown"),
    }
  }
}

export async function markExpenseAsPaid(id: string, unitId: string) {
  try {
    await goFetch<Expense>(`/api/v1/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "PAID" }),
    })

    revalidatePath(`/units/${unitId}`)
    return { success: true }
  } catch (error) {
    return {
      error: "Erro ao marcar como pago: " + (error instanceof Error ? error.message : "unknown"),
    }
  }
}

export async function deleteExpense(id: string, unitId: string) {
  try {
    await goFetch<{ deleted: boolean }>(`/api/v1/expenses/${id}`, {
      method: "DELETE",
    })

    revalidatePath(`/units/${unitId}`)
    return { success: true }
  } catch (error) {
    return {
      error: "Erro ao excluir despesa: " + (error instanceof Error ? error.message : "unknown"),
    }
  }
}