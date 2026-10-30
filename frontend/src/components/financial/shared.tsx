import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Filter } from "lucide-react"
import type { Bucket, LedgerStatus } from "@/data/financial/dal"
import type { FinancialFilters } from "@/lib/financial-schemas"

export const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

// Datas do backend são DATE (meia-noite UTC): formatar em UTC evita voltar um dia no fuso do Brasil.
export const fmtDate = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: "UTC" })

const STATUS: Record<LedgerStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "A vencer", variant: "outline" },
  LATE: { label: "Atrasado", variant: "destructive" },
  PAID: { label: "Pago", variant: "default" },
}

export function StatusBadge({ status }: { status: LedgerStatus }) {
  const s = STATUS[status] ?? { label: status, variant: "secondary" as const }
  return <Badge variant={s.variant}>{s.label}</Badge>
}

interface SummaryCardsProps {
  /** Rótulos dos três grupos, na ordem: a vencer, vencidos, pagos. */
  labels: [string, string, string]
  buckets: [Bucket, Bucket, Bucket] | null
}

export function SummaryCards({ labels, buckets }: SummaryCardsProps) {
  if (!buckets) {
    return <p className="text-sm text-muted-foreground">Não foi possível carregar os totais.</p>
  }
  const tones = ["", "border-l-4 border-l-destructive", ""]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {buckets.map((b, i) => (
        <Card key={labels[i]} className={tones[i]}>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{labels[i]}</div>
            <div className="text-2xl font-bold">{money(b.total)}</div>
            <div className="text-xs text-muted-foreground">{b.count} {b.count === 1 ? "lançamento" : "lançamentos"}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface FilterBarProps {
  action: string
  filters: FinancialFilters
  refLabel: string
  refOptions: { value: string; label: string }[]
}

/** Filtros por GET: o estado fica na URL e a página renderiza no servidor. */
export function FilterBar({ action, filters, refLabel, refOptions }: FilterBarProps) {
  return (
    <Card className="p-4">
      <form action={action} method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Status</span>
          <select name="status" defaultValue={filters.status ?? ""} className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm">
            <option value="">Todos</option>
            <option value="PENDING">A vencer</option>
            <option value="LATE">Atrasado</option>
            <option value="PAID">Pago</option>
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Vencimento de</span>
          <Input type="date" name="from" defaultValue={filters.from ?? ""} />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">até</span>
          <Input type="date" name="to" defaultValue={filters.to ?? ""} />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">{refLabel}</span>
          <select name="ref" defaultValue={filters.ref ?? ""} className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm">
            <option value="">Todos</option>
            {refOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1">
            <Filter className="w-4 h-4 mr-2" /> Filtrar
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href={action}>Limpar</Link>
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function ErrorState({ message, retryHref }: { message: string; retryHref: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 border border-border rounded-xl bg-card">
      <p className="text-muted-foreground">{message}</p>
      <Button variant="outline" asChild>
        <Link href={retryHref}>Tentar novamente</Link>
      </Button>
    </div>
  )
}
