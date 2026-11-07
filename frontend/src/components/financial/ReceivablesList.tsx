'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import type { Situation } from '@/lib/financial-overview'
import { RegisterPaymentDialog } from '@/components/financial/RegisterPaymentDialog'
import { SituationBadge } from '@/components/financial/SituationBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { plural } from '@/lib/property-format'

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
}

const LABELS = { LATE: 'Atrasado', PAID: 'Pago', PENDING: 'Previsto' } as const

type Props = {
  /** Linhas visíveis (já filtradas pelo chip). */
  rows: ReceivableItem[]
  /** Todas as cobranças abertas do mês, para o botão do topo. */
  openRows: ReceivableItem[]
}

export function ReceivablesList({ rows, openRows }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' })
  const open = (id: string) => setDialog({ open: true, id })

  // Uma ação por linha, como no canvas: Recibo (paga), Cobrar (atrasada) ou Enviar cobrança (prevista).
  const action = (r: ReceivableItem) =>
    r.situation === 'PAID' ? (
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
          <Card className="hidden gap-0 overflow-hidden p-0 md:block">
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
