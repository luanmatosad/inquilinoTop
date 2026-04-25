"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"

export type PaymentActionState = {
  error?: string
  success?: string
} | null

interface Payment {
  id: string
  lease_id: string
  due_date: string
  paid_date?: string
  gross_amount: number
  status: string
  type: string
  created_at: string
}

export async function generateInitialPayments(
  leaseId: string,
  startDate: string,
  amount: number,
  paymentDay: number
) {
  const payments = []
  const monthsToGenerate = 12

  const start = new Date(startDate)
  start.setHours(12, 0, 0, 0)

  let currentMonth = start.getMonth()
  let currentYear = start.getFullYear()

  if (start.getDate() >= paymentDay) {
    currentMonth++
  }

  for (let i = 0; i < monthsToGenerate; i++) {
    const dueDate = new Date(currentYear, currentMonth + i, paymentDay, 12, 0, 0, 0)

    const monthName = dueDate.toLocaleString("pt-BR", { month: "long" })
    const yearName = dueDate.getFullYear()
    const description = `Aluguel ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${yearName}`

    try {
      await goFetch<Payment>(`/api/v1/leases/${leaseId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          due_date: dueDate.toISOString().split("T")[0],
          gross_amount: amount,
          type: "RENT",
          description: description,
        }),
      })
    } catch (error) {
      console.error("Erro ao gerar pagamento:", error)
    }
  }

  return { success: true }
}

export async function markAsPaid(paymentId: string, leaseId: string) {
  try {
    await goFetch<Payment>(`/api/v1/payments/${paymentId}`, {
      method: "PUT",
      body: JSON.stringify({
        status: "PAID",
        paid_date: new Date().toISOString(),
        gross_amount: 0,
      }),
    })

    revalidatePath(`/units/${leaseId}`)
    return { success: true }
  } catch (error) {
    return {
      error: "Erro ao marcar como pago: " + (error instanceof Error ? error.message : "unknown"),
    }
  }
}

export async function markAsPending(paymentId: string, leaseId: string) {
  try {
    await goFetch<Payment>(`/api/v1/payments/${paymentId}`, {
      method: "PUT",
      body: JSON.stringify({
        status: "PENDING",
        paid_date: null,
        gross_amount: 0,
      }),
    })

    revalidatePath(`/units/${leaseId}`)
    return { success: true }
  } catch (error) {
    return {
      error: "Erro ao reabrir pagamento: " + (error instanceof Error ? error.message : "unknown"),
    }
  }
}