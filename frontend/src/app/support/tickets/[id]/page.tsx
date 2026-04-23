import { goFetch } from "@/lib/go/client"
import Link from "next/link"
import { ArrowLeft, Clock, Tag } from "lucide-react"

interface Ticket {
  id: string
  tipo: string
  assunto: string
  descricao: string
  status: string
  created_at: string
  updated_at: string
}

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
}

const statusColors: Record<string, string> = {
  open: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  resolved: "bg-success/10 text-success",
  closed: "bg-on-surface-variant/10 text-on-surface-variant",
}

const tipoLabels: Record<string, string> = {
  duvida: "Dúvida",
  sugestao: "Sugestão",
  reclamacao: "Reclamação",
  outro: "Outro",
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let ticket: Ticket

  try {
    ticket = await goFetch<Ticket>(`/api/v1/tickets/${id}`, {})
  } catch (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-on-surface-variant">Ticket não encontrado.</p>
        <Link href="/support/tickets" className="mt-4 text-primary hover:underline block">
          Voltar para lista
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/support/tickets"
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar</span>
      </Link>

      <div className="bg-surface p-6 rounded-xl border border-outline">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-on-surface-variant" />
            <span className="text-on-surface-variant">
              {tipoLabels[ticket.tipo] || ticket.tipo}
            </span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              statusColors[ticket.status] || statusColors.open
            }`}
          >
            {statusLabels[ticket.status] || ticket.status}
          </span>
        </div>

        <h1 className="text-xl font-semibold text-on-surface mb-4">
          {ticket.assunto}
        </h1>

        <div className="prose prose-invert max-w-none">
          <p className="text-on-surface-variant whitespace-pre-wrap">{ticket.descricao}</p>
        </div>

        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-outline text-sm text-on-surface-variant">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Criado em {new Date(ticket.created_at).toLocaleString("pt-BR")}</span>
          </div>
          {ticket.updated_at !== ticket.created_at && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                Atualizado em {new Date(ticket.updated_at).toLocaleString("pt-BR")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}