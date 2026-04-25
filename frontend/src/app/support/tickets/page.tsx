import { goFetch } from "@/lib/go/client"
import Link from "next/link"
import { Clock, Tag, ChevronRight } from "lucide-react"

interface Ticket {
  id: string
  tipo: string
  assunto: string
  status: string
  created_at: string
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

export default async function TicketsPage() {
  let tickets: Ticket[] = []

  try {
    tickets = await goFetch<Ticket[]>("/api/v1/tickets", {})
  } catch (error) {
    console.error("Erro ao buscar tickets:", error)
    return <div className="p-8 text-center">Erro ao carregar tickets.</div>
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-on-surface-variant text-lg">Nenhum ticket encontrado.</p>
        <Link
          href="/support/new-ticket"
          className="mt-4 inline-block text-primary hover:underline"
        >
          Abrir novo chamado
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">Meus Chamados</h1>
        <Link
          href="/support/new-ticket"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Novo Chamado
        </Link>
      </div>

      <div className="space-y-2">
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/support/tickets/${ticket.id}`}
            className="block bg-surface p-4 rounded-lg border border-outline hover:border-primary hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Tag className="w-4 h-4 text-on-surface-variant" />
                  <span className="text-sm text-on-surface-variant">
                    {tipoLabels[ticket.tipo] || ticket.tipo}
                  </span>
                </div>
                <h3 className="font-medium text-on-surface">{ticket.assunto}</h3>
                <div className="flex items-center gap-1 mt-2 text-sm text-on-surface-variant">
                  <Clock className="w-4 h-4" />
                  {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    statusColors[ticket.status] || statusColors.open
                  }`}
                >
                  {statusLabels[ticket.status] || ticket.status}
                </span>
                <ChevronRight className="w-5 h-5 text-on-surface-variant" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}