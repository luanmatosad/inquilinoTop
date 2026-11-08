import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date-format'
import { plural } from '@/lib/property-format'
import type { Period, RowSituation, StatementRow, statementIndicators } from '@/lib/tenant-statement'

type Kpis = ReturnType<typeof statementIndicators>

const DOT: Record<RowSituation, { text: string; dot: string }> = {
  PAID: { text: 'Pago', dot: 'bg-success' },
  PAID_LATE: { text: 'Pago com atraso', dot: 'bg-warning' },
  LATE: { text: 'Atrasado', dot: 'bg-destructive' },
  AWAITING: { text: 'Aguardando confirmação', dot: 'bg-warning' },
  PENDING: { text: 'Previsto', dot: 'bg-muted-foreground' },
}

export function RowBadge({ situation }: { situation: RowSituation }) {
  const { text, dot } = DOT[situation]
  return (
    <Badge variant="outline">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {text}
    </Badge>
  )
}

export function StatementKpis({ k }: { k: Kpis }) {
  const p = k.punctual
  return (
    <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
      <Card className="gap-1 p-4">
        <div className="text-sm font-medium text-muted-foreground">Recebido</div>
        <div className="text-[22px] font-semibold md:text-[28px]">{formatCurrency(k.received.total)}</div>
        <div className="text-sm text-muted-foreground">{plural(k.received.count, 'pagamento', 'pagamentos')}</div>
      </Card>
      <Card className="gap-1 p-4">
        <div className="text-sm font-medium text-muted-foreground">Pontualidade</div>
        <div className="text-[22px] font-semibold md:text-[28px]">{p.paid ? `${p.onTime} de ${p.paid}` : '—'}</div>
        <div className="text-sm text-muted-foreground">
          {p.paid ? (p.late ? `${plural(p.late, 'pago com atraso', 'pagos com atraso')}` : 'pagos até o vencimento') : 'sem pagamentos no período'}
        </div>
      </Card>
      {k.overdueNow ? (
        <Card className="gap-1 p-4">
          <div className="text-sm font-medium text-muted-foreground">Em atraso agora</div>
          <div className="text-[22px] font-semibold text-destructive md:text-[28px]">{formatCurrency(k.overdueNow.total)}</div>
          <div className="text-sm text-muted-foreground">
            {plural(k.overdueNow.days, 'dia', 'dias')} · {k.overdueNow.month}
          </div>
        </Card>
      ) : (
        <Card className="gap-1 p-4">
          <div className="text-sm font-medium text-muted-foreground">Atrasos</div>
          <div className="text-[22px] font-semibold md:text-[28px]">{k.lateCount}</div>
          <div className="text-sm text-muted-foreground">no período</div>
        </Card>
      )}
    </section>
  )
}

export function PeriodFilter({ id, period, currentYear }: { id: string; period: Period; currentYear: number }) {
  const base = `/tenants/${id}/extrato`
  const chip = (on: boolean) =>
    `inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[13px] font-medium md:h-7 ${
      on ? 'border-accent bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-accent'
    }`
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <nav aria-label="Período" className="flex gap-2 overflow-x-auto">
        <Link href={base} aria-current={period.kind === '12m' ? 'true' : undefined} className={chip(period.kind === '12m')}>
          Últimos 12 meses
        </Link>
        <Link
          href={`${base}?periodo=${currentYear}`}
          aria-current={period.kind === 'year' ? 'true' : undefined}
          className={chip(period.kind === 'year')}
        >
          {currentYear}
        </Link>
      </nav>
      <form action={base} method="get" className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="periodo" value="custom" />
        <label className="flex items-center gap-1">
          De
          <input type="month" name="de" defaultValue={period.kind === 'custom' ? period.from.slice(0, 7) : ''} className="h-9 rounded-md border bg-background px-2" />
        </label>
        <label className="flex items-center gap-1">
          até
          <input type="month" name="ate" defaultValue={period.kind === 'custom' ? period.to.slice(0, 7) : ''} className="h-9 rounded-md border bg-background px-2" />
        </label>
        <button type="submit" className={chip(period.kind === 'custom')}>
          Personalizado
        </button>
      </form>
    </div>
  )
}

export function StatementTable({ rows }: { rows: StatementRow[] }) {
  if (!rows.length) return <p className="p-4 text-sm text-muted-foreground">Nenhuma cobrança no período.</p>
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <span className="w-24 font-medium">{formatDateBR(r.payment.due_date)}</span>
          <RowBadge situation={r.situation} />
          <span className="text-muted-foreground">
            {r.payment.paid_date ? `pago em ${formatDateBR(r.payment.paid_date)}` : 'não pago'}
          </span>
          <span className="ml-auto font-medium">{formatCurrency(r.amount)}</span>
        </li>
      ))}
    </ul>
  )
}
