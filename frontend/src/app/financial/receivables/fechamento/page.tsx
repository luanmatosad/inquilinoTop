import Link from 'next/link'

import { goFetch } from '@/lib/go/client'
import { formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date-format'
import { formatMonthLabel, parseMonth } from '@/lib/financial-overview'
import { buildChecklist, closedAtLabel, isPastMonth, pendingSummary, type MonthClosing } from '@/lib/month-closing'
import { plural } from '@/lib/property-format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClosingActions } from '@/components/financial/ClosingActions'
import { FinancialKpis } from '@/components/financial/FinancialKpis'
import { PrintButton } from '@/components/financial/PrintButton'

const BASE = '/financial/receivables'

export default async function ClosingPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams
  const ym = parseMonth(mes)
  const label = formatMonthLabel(ym).toLowerCase()
  const Label = formatMonthLabel(ym)
  const monthName = label.split(' ')[0]

  const crumb = (
    <nav aria-label="Navegação" className="text-sm text-muted-foreground print:hidden">
      <Link href={`${BASE}?mes=${ym}`} className="hover:underline">
        Recebimentos
      </Link>{' '}
      › Fechamento
    </nav>
  )

  let closing: MonthClosing | undefined
  try {
    closing = await goFetch<MonthClosing>(`/api/v1/closings?month=${ym}`, {})
  } catch (error) {
    console.error('Erro ao buscar o fechamento:', error)
  }

  if (!closing) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {crumb}
        <h1 className="text-2xl font-semibold leading-[1.2]">Fechamento de {label}</h1>
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">
          <p className="text-muted-foreground">Não foi possível carregar o fechamento.</p>
          <Button asChild variant="outline">
            <Link href={`${BASE}/fechamento?mes=${ym}`}>Tentar novamente</Link>
          </Button>
        </div>
      </div>
    )
  }

  const s = closing.snapshot
  const closed = closing.status === 'CLOSED'
  const past = isPastMonth(ym)
  const kpis = [
    { label: 'Previsto', value: formatCurrency(s.forecast.total), sub: plural(s.forecast.count, 'cobrança', 'cobranças') },
    { label: 'Recebido', value: formatCurrency(s.received.total), sub: `${s.received.count} de ${s.forecast.count} pagas` },
    { label: 'Em atraso', value: formatCurrency(s.overdue.total), sub: s.overdue.count ? plural(s.overdue.count, 'cobrança', 'cobranças') : 'nenhuma cobrança' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-1">
          {crumb}
          <h1 className="text-2xl font-semibold leading-[1.2]">{closed ? Label : `Fechar ${label}`}</h1>
          <p className="text-sm text-muted-foreground">
            {closed ? 'Somente leitura' : 'Confira antes de fechar. Dá para reabrir depois.'}
          </p>
          {closed && (
            <div className="pt-1">
              <Badge variant="outline">Fechado</Badge>
            </div>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2 print:hidden">
          <PrintButton label={closed ? 'Baixar resumo (PDF)' : 'Exportar resumo'} />
          {closed ? (
            <ClosingActions month={ym} monthLabel={label} mode="reopen" />
          ) : (
            past && <ClosingActions month={ym} monthLabel={label} mode="close" pendingText={s.pending.length ? pendingSummary(s.pending) : ''} />
          )}
        </div>
      </div>

      {!closed && !past && (
        <p role="status" className="text-sm text-muted-foreground">
          {Label} ainda não terminou. O fechamento fica disponível depois do último dia do mês.
        </p>
      )}

      {closed && <p className="text-sm text-muted-foreground">Os números de {monthName} não mudam sem reabrir.</p>}

      <FinancialKpis kpis={kpis} mobile={[kpis[1], kpis[0]]} />

      {!closed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Antes de fechar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {buildChecklist(s).map((item) => (
              <div key={item.key} className="flex items-start gap-3">
                <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${item.ok ? 'bg-success' : 'bg-warning'}`} />
                <div className="flex flex-col">
                  <span className="font-medium">{item.title}</span>
                  {item.text && <span className="text-muted-foreground">{item.text}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {closed && closing.closed_at && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mês fechado</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <span>Fechado em {closedAtLabel(closing.closed_at)}</span>
            <span className="text-muted-foreground">
              Por {closing.closed_by_name} · {pendingSummary(s.pending)}
            </span>
            {s.pending.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1">
                {s.pending.map((p) => (
                  <li key={p.payment_id} className="flex justify-between gap-4">
                    <span>
                      {p.tenant} · {formatDateBR(p.due_date)}
                      {p.awaiting ? ' · aguardando confirmação' : ''}
                    </span>
                    <span>{formatCurrency(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {closing.events.length > 0 && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">Histórico do mês</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {closing.events.map((e) => (
              <div key={e.id} className="flex flex-col">
                <span className="font-medium">
                  {e.kind === 'CLOSED' ? 'Fechado' : 'Reaberto'} por {e.actor_name} · {closedAtLabel(e.created_at)}
                </span>
                {e.reason && <span className="text-muted-foreground">Motivo: {e.reason}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
