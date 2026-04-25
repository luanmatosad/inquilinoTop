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

const ticketTypes = ["duvida", "sugestao", "reclamacao", "outro"]

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

export async function getTickets(): Promise<ActionResponse<Ticket[]>> {
  try {
    const tickets = await goFetch<Ticket[]>("/api/v1/tickets", {
      method: "GET",
    })
    return { success: true, data: tickets }
  } catch (error) {
    console.error("Erro ao listar tickets:", error)
    return { error: "Erro ao listar tickets" }
  }
}

export async function getTicketById(id: string): Promise<ActionResponse<Ticket>> {
  try {
    const ticket = await goFetch<Ticket>("/api/v1/tickets/" + id, {
      method: "GET",
    })
    return { success: true, data: ticket }
  } catch (error) {
    console.error("Erro ao buscar ticket:", error)
    return { error: "Erro ao buscar ticket" }
  }
}