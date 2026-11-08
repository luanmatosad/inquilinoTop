'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import type { Situation } from '@/lib/financial-overview'
import { ConfirmReportDialog, type ReportInfo } from '@/components/financial/ConfirmReportDialog'
import { RegisterPaymentDialog } from '@/components/financial/RegisterPaymentDialog'
import { SituationBadge } from '@/components/financial/SituationBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { plural } from '@/lib/property-format'
import { formatCurrency } from '@/lib/utils'

export type ReceivableItem = {
  id: string
  tenant: string
  where: string
  /** "05/11". */
  due: string
  /** Valor bruto já formatado. */
  amount: string
  grossAmount: number
  /** Valor devido hoje (bruto, ou bruto + multa + juros se atrasada), para limitar o desconto. */
  totalDue: number
  /** Total atualizado com multa e juros, formatado; só quando `LATE`. */
  updatedTotal?: string
  situation: Situation
  /** Aviso "já paguei" pendente (situação `AWAITING`), com os textos prontos para o diálogo. */
  report?: { amount: string; when: string; hasProof: boolean; differsFromDue: boolean }
}

const LABELS = { LATE: 'Atrasado', PAID: 'Pago', PENDING: 'Previsto', AWAITING: 'Aguardando confirmação' } as const

type Props = {
  /** Linhas visíveis (já filtradas pelo chip). */
  rows: ReceivableItem[]
  /** Todas as cobranças abertas do mês, para o botão do topo. */
  openRows: ReceivableItem[]
}

export function ReceivablesList({ rows, openRows }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' })
  const [confirming, setConfirming] = useState<ReportInfo | null>(null)
  const open = (id: string) => setDialog({ open: true, id })

  const confirm = (r: ReceivableItem) =>
    r.report &&
    setConfirming({
      paymentId: r.id,
      tenantName: r.tenant,
      reportedAmount: r.report.amount,
      reportedWhen: r.report.when,
      hasProof: r.report.hasProof,
      differsFromDue: r.report.differsFromDue,
      dueTotal: formatCurrency(r.totalDue),
    })

  // Uma ação por linha, como no canvas: Recibo (paga), Confirmar (aviso do inquilino), Cobrar (atrasada) ou Enviar cobrança (prevista).
  const action = (r: ReceivableItem) =>
    r.situation === 'AWAITING' && r.report ? (
      <Button type="button" variant="outline" size="sm" onClick={() => confirm(r)}>
        Confirmar
      </Button>
    ) : r.situation === 'PAID' ? (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/financial/receivables/${r.id}/receipt`}>Recibo</Link>
      </Button>
    ) : (
      <Button asChild variant="outline" size="sm">
        <Link href={`/financial/receivables/${r.id}?enviar=1`}>{r.situation === 'LATE' ? 'Cobrar' : 'Enviar cobrança'}</Link>
      </Button>
    )

  return (
    <>
      <div className="flex justify-end max-md:hidden">
        <Button type="button" disabled={openRows.length === 0} onClick={() => open(openRows[0]?.id ?? '')}>
          Registrar pagamento
        </Button>
      </div>

      {rows.length > 0 && (
        <>
          <Card size="flush" className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-4">Inquilino e imóvel</TableHead>
                  <TableHead>Vence em</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">Ação</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="h-16">
                    <TableCell className="px-4">
                      <Link href={`/financial/receivables/${r.id}`} className="font-medium hover:underline">
                        {r.tenant}
                      </Link>
                      <div className="text-sm text-muted-foreground">{r.where}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.due}</TableCell>
                    <TableCell>{r.amount}</TableCell>
                    <TableCell>
                      <SituationBadge situation={r.situation} labels={LABELS} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">{action(r)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">{plural(rows.length, 'cobrança', 'cobranças')}</div>
          </Card>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Card className="gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/financial/receivables/${r.id}`} className="font-medium hover:underline">
                        {r.tenant}
                      </Link>
                      <div className="text-sm text-muted-foreground">{r.where}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{r.amount}</div>
                      <div className="text-xs text-muted-foreground">vence {r.due}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <SituationBadge situation={r.situation} labels={LABELS} />
                    {action(r)}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmReportDialog open={confirming !== null} info={confirming} onClose={() => setConfirming(null)} onDone={() => router.refresh()} />

      <RegisterPaymentDialog
        key={dialog.open ? dialog.id : 'closed'}
        open={dialog.open}
        initialId={dialog.id}
        items={openRows}
        onClose={() => setDialog({ open: false, id: '' })}
        onDone={() => router.refresh()}
      />
    </>
  )
}
