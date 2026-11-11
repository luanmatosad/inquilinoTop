"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"

type ActionResponse<T = void> = {
  success?: boolean
  data?: T
  error?: string
  details?: Record<string, string[]>
}

interface Ticket {
  id: string
  user_id: string
  tipo: string
  assunto: string
  descricao: string
  status: string
  created_at: string
  updated_at: string
}

interface CreateTicketInput {
  tipo: string
  assunto: string
  descricao: string
}

const ticketTypes = ["DOUBT", "FEATURE", "BUG", "PAYMENT"]

export async function createTicket(data: CreateTicketInput): Promise<ActionResponse<Ticket>> {
  if (!data.tipo || !ticketTypes.includes(data.tipo)) {
    return { error: "Tipo inválido" }
  }
  if (!data.assunto?.trim()) {
    return { error: "Assunto é obrigatório" }
  }
  if (!data.descricao?.trim()) {
    return { error: "Descrição é obrigatória" }
  }

  try {
    const ticket = await goFetch<Ticket>("/api/v1/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    })

    revalidatePath("/support/tickets")
    return { success: true, data: ticket }
  } catch (error) {
    console.error("Erro ao criar ticket:", error)
    return { error: "Erro ao criar ticket" }
  }
}