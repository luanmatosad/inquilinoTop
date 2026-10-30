'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Receipt } from 'lucide-react'

import { payReceivable } from '@/app/financial/actions'
import { payReceivableSchema, type PayReceivableFormValues } from '@/lib/financial-schemas'
import type { ReceivableRow } from '@/data/financial/dal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge, fmtDate, money } from './shared'

const TYPE: Record<ReceivableRow['type'], string> = {
  RENT: 'Aluguel',
  DEPOSIT: 'Caução',
  EXPENSE: 'IPTU / despesa',
  OTHER: 'Outro',
}

const today = () => new Date().toISOString().split('T')[0]

interface ReceivablesTableProps {
  rows: ReceivableRow[]
  leaseLabels: Record<string, string>
}

export function ReceivablesTable({ rows, leaseLabels }: ReceivablesTableProps) {
  const router = useRouter()
  const [paying, setPaying] = useState<ReceivableRow | null>(null)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-1 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground">Nenhuma cobrança encontrada para os filtros.</p>
        <p className="text-sm text-muted-foreground">As cobranças nascem dos contratos; crie um contrato com &quot;Gerar cobranças&quot;.</p>
      </div>
    )
  }

  return (
    <>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{fmtDate(r.dueDate)}</TableCell>
                <TableCell>
                  <Link href={`/leases/${r.leaseId}`} className="hover:underline">
                    {leaseLabels[r.leaseId] ?? 'Contrato'}
                  </Link>
                </TableCell>
                <TableCell>{TYPE[r.type] ?? r.type}</TableCell>
                <TableCell>{r.competency ?? '—'}</TableCell>
                <TableCell className="text-right">
                  {r.status === 'LATE' ? (
                    <>
                      <div className="font-semibold">{money(r.updatedTotal)}</div>
                      <div className="text-xs text-muted-foreground">
                        {money(r.amount)} + multa {money(r.lateFee)} + juros {money(r.interest)}
                      </div>
                    </>
                  ) : (
                    money(r.status === 'PAID' ? (r.netAmount ?? r.amount) : r.amount)
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                  {r.paidDate && <div className="text-xs text-muted-foreground">em {fmtDate(r.paidDate)}</div>}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === 'PAID' ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/financial/receivables/${r.id}/receipt`}>
                        <Receipt className="w-4 h-4 mr-1" /> Recibo
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setPaying(r)}>
                      Dar baixa
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <PayDialog row={paying} onClose={() => setPaying(null)} onDone={() => router.refresh()} />
    </>
  )
}

function PayDialog({ row, onClose, onDone }: { row: ReceivableRow | null; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const form = useForm<PayReceivableFormValues>({
    resolver: zodResolver(payReceivableSchema),
    defaultValues: { paid_date: today() },
  })

  async function onSubmit(values: PayReceivableFormValues) {
    if (!row) return
    setLoading(true)
    try {
      const result = await payReceivable(row.id, row.amount, values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof PayReceivableFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success('Baixa registrada! O recibo já está disponível.')
      onClose()
      onDone()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar baixa na cobrança</DialogTitle>
          <DialogDescription>
            {row
              ? `Vencimento ${fmtDate(row.dueDate)} · ${money(row.amount)}. Multa, juros e IRRF são calculados pela data informada.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="paid_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do recebimento *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar baixa
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
