'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

import { ConfirmReportDialog, type ReportInfo } from '@/components/financial/ConfirmReportDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateBR } from '@/lib/date-format'
import { plural } from '@/lib/property-format'
import { whenLabel, initials } from '@/lib/public-charge'
import type { TodayRow, WatchItem } from '@/lib/today-overview'
import { formatCurrency } from '@/lib/utils'

type Props = { confirm: TodayRow[]; late: TodayRow[]; collect: TodayRow[]; watch: WatchItem[] }

const dm = (ymd: string) => formatDateBR(ymd).slice(0, 5)
const INDEX_LABEL: Record<string, string> = { IGPM: 'IGP-M', IPCA: 'IPCA' }

function Section({ title, count, description, children }: { title: string; count?: number; description?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <Card size="flush" className="gap-0">
        <div className="flex flex-col gap-1 p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {title}
            {count !== undefined && <span className="inline-flex h-5 items-center rounded-full bg-secondary px-2 text-xs font-medium">{count}</span>}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </Card>
    </section>
  )
}

function Person({ row }: { row: TodayRow }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-medium">
        {row.tenant === '—' ? '?' : initials(row.tenant)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{row.tenant}</div>
        <div className="truncate text-sm text-muted-foreground">{row.where}</div>
      </div>
      <div className="text-base font-semibold">{formatCurrency(row.amount)}</div>
    </div>
  )
}

function Row({ row, dot, badge, meta, action }: { row: TodayRow; dot: string; badge: string; meta: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t p-4 md:flex-row md:items-center md:gap-6">
      <div className="md:flex-1">
        <Person row={row} />
      </div>
      <div className="flex items-center justify-between gap-2 md:justify-end md:gap-4">
        <Badge variant="outline">
          <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
          {badge}
        </Badge>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </div>
      <div className="max-md:[&>*]:h-11 max-md:[&>*]:w-full">{action}</div>
    </div>
  )
}

function untilLabel(days: number) {
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  return `Vence em ${days} dias`
}

export function TodayLists({ confirm, late, collect, watch }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<ReportInfo | null>(null)

  const openConfirm = (r: TodayRow) =>
    setConfirming({
      paymentId: r.id,
      tenantName: r.tenant,
      reportedAmount: formatCurrency(r.reportedAmount ?? r.amount),
      reportedWhen: r.reportedAt ? whenLabel(r.reportedAt) : '',
      hasProof: !!r.hasProof,
      differsFromDue: r.reportedAmount != null && Math.abs(r.reportedAmount - r.totalDue) > 0.01,
      dueTotal: formatCurrency(r.totalDue),
    })

  return (
    <>
      <Section title="Confirmar pagamento" count={confirm.length} description="Seus inquilinos avisaram que pagaram. Confira na sua conta e confirme.">
        {confirm.length === 0 ? (
          <p className="border-t p-4 text-sm text-muted-foreground">Nada para confirmar. Quando um inquilino avisar que pagou, aparece aqui.</p>
        ) : (
          confirm.map((r) => (
            <Row
              key={r.id}
              row={r}
              dot="bg-warning"
              badge="Informado pelo inquilino"
              meta={r.reportedAt ? `Avisou ${whenLabel(r.reportedAt).toLowerCase()}` : ''}
              action={
                <Button type="button" variant="outline" onClick={() => openConfirm(r)}>
                  <Check className="size-4" aria-hidden="true" />
                  Confirmar
                </Button>
              }
            />
          ))
        )}
      </Section>

      {late.length > 0 && (
        <Section title="Atrasados" count={late.length} description="A multa e os juros do contrato já entram na mensagem.">
          {late.map((r) => (
            <Row
              key={r.id}
              row={r}
              dot="bg-destructive"
              badge={`${plural(r.daysLate, 'dia', 'dias')} de atraso`}
              meta={`Venceu em ${dm(r.due)}`}
              action={
                <Button asChild variant="outline">
                  <Link href={`/financial/receivables/${r.id}?enviar=1`}>Cobrar</Link>
                </Button>
              }
            />
          ))}
        </Section>
      )}

      {collect.length > 0 && (
        <Section title="Para cobrar" count={collect.length} description="Abre o envio com a mensagem e o link de pagamento prontos.">
          {collect.map((r) => (
            <Row
              key={r.id}
              row={r}
              dot="bg-warning"
              badge={untilLabel(r.daysUntil)}
              meta={`Vence em ${dm(r.due)}`}
              action={
                <Button asChild variant="outline">
                  <Link href={`/financial/receivables/${r.id}?enviar=1`}>Enviar cobrança</Link>
                </Button>
              }
            />
          ))}
        </Section>
      )}

      {watch.length > 0 && (
        <Section title="Fique de olho" description="Coisas que pedem sua decisão nas próximas semanas.">
          {watch.map((w) => (
            <div key={`${w.kind}-${w.leaseId}`} className="flex flex-col gap-2 border-t p-4 md:flex-row md:items-center md:justify-between md:gap-6">
              {w.kind === 'READJUST' ? (
                <>
                  <div>
                    <div className="text-sm font-medium">{`Reajuste do ${w.where} ${w.pending ? 'está pendente' : `chega em ${dm(w.date)}`}`}</div>
                    <div className="text-sm text-muted-foreground">
                      {w.pending
                        ? 'O mês do reajuste já passou. Revise e aplique o novo valor.'
                        : `Previsto para ${dm(w.date)}${w.index ? `, pelo ${INDEX_LABEL[w.index] ?? w.index}` : ''}. Revise o valor antes de aplicar.`}
                    </div>
                  </div>
                  <Button asChild variant="outline" className="max-md:h-11 max-md:w-full">
                    <Link href={`/leases/${w.leaseId}?reajustar=1`}>Revisar reajuste</Link>
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-sm font-medium">{`Contrato do ${w.where} termina em ${plural(w.days ?? 0, 'dia', 'dias')}`}</div>
                    <div className="text-sm text-muted-foreground">Vence em {dm(w.date)}. Renove ou encerre antes do prazo.</div>
                  </div>
                  <Button asChild variant="outline" className="max-md:h-11 max-md:w-full">
                    <Link href={`/leases/${w.leaseId}`}>Ver contrato</Link>
                  </Button>
                </>
              )}
            </div>
          ))}
        </Section>
      )}

      <ConfirmReportDialog open={confirming !== null} info={confirming} onClose={() => setConfirming(null)} onDone={() => router.refresh()} />
    </>
  )
}
