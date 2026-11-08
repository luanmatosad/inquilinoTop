import { Card } from '@/components/ui/card'
import { plural } from '@/lib/property-format'
import { formatCurrency } from '@/lib/utils'
import type { buildToday } from '@/lib/today-overview'

type Kpis = ReturnType<typeof buildToday>['kpis']

function Progress({ value }: { value: number }) {
  return (
    <div role="progressbar" aria-label="Recebido do previsto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="my-0.5 h-1.5 rounded-full bg-muted">
      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  )
}

const Dot = ({ className }: { className: string }) => <span aria-hidden="true" className={`size-1.5 rounded-full ${className}`} />

/** Previsto, Recebido (com barra) e Em atraso. Celular: só Recebido e Em atraso, em dois cartões. */
export function TodayKpis({ kpis, monthLabel }: { kpis: Kpis; monthLabel: string }) {
  const lateSub = kpis.late.count
    ? `${plural(kpis.late.count, 'cobrança', 'cobranças')}, a mais antiga há ${plural(kpis.oldestLateDays, 'dia', 'dias')}`
    : 'nenhuma cobrança'
  const forecastSub = kpis.forecast.count ? plural(kpis.forecast.count, 'cobrança no mês', 'cobranças no mês') : 'sem cobranças ainda'
  return (
    <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      <Card className="hidden gap-1 p-4 md:flex">
        <div className="text-sm font-medium text-muted-foreground">Previsto em {monthLabel}</div>
        <div className="text-[28px] font-semibold leading-9">{formatCurrency(kpis.forecast.total)}</div>
        <div className="text-sm text-muted-foreground">{forecastSub}</div>
      </Card>
      <Card className="gap-1 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Dot className="bg-success" />
          Recebido
        </div>
        <div className="text-[22px] font-semibold leading-[30px] md:text-[28px] md:leading-9">{formatCurrency(kpis.received.total)}</div>
        <Progress value={kpis.receivedPercent} />
        <div className="text-xs text-muted-foreground md:text-sm">de {formatCurrency(kpis.forecast.total)} previstos</div>
      </Card>
      <Card className="gap-1 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Dot className="bg-destructive" />
          Em atraso
        </div>
        <div className="text-[22px] font-semibold leading-[30px] md:text-[28px] md:leading-9">{formatCurrency(kpis.late.total)}</div>
        <div className="text-xs text-muted-foreground md:text-sm">{lateSub}</div>
      </Card>
    </section>
  )
}
