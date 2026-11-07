import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

export type LeaseKpiData = {
  activeCount: number
  activeRent: number
  expiring30: number
  readjust90: number
  endedCount: number
  /** "Unidade · Imóvel" dos contratos que reajustam em até 90 dias. */
  readjustWhere: string
}

function Kpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <Card className="gap-1 p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-[28px] font-semibold leading-9">{value}</div>
      <div className="text-sm text-muted-foreground">{sub}</div>
    </Card>
  )
}

export function LeaseKpis({ k }: { k: LeaseKpiData }) {
  return (
    <section aria-label="Indicadores" className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Ativos" value={k.activeCount} sub={`${formatCurrency(k.activeRent)} por mês`} />
      <Kpi label="Vencendo em 30 dias" value={k.expiring30} sub={k.expiring30 ? 'termina em breve' : 'nenhum'} />
      <Kpi label="Reajuste em 90 dias" value={k.readjust90} sub={k.readjust90 ? k.readjustWhere : 'nenhum'} />
      <Kpi label="Encerrados" value={k.endedCount} sub="no histórico" />
    </section>
  )
}
