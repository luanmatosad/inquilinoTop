'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { payReceivable } from '@/app/financial/actions'
import { payReceivableSchema, type PayReceivableFormValues } from '@/lib/financial-schemas'
import type { Situation } from '@/lib/financial-overview'
import { SituationBadge } from '@/components/financial/SituationBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  /** Total atualizado com multa e juros, formatado; só quando `LATE`. */
  updatedTotal?: string
  situation: Situation
}

const LABELS = { LATE: 'Atrasado', PAID: 'Pago', PENDING: 'Previsto' } as const
const todayLocal = () => new Date().toLocaleDateString('en-CA')

type Props = {
  /** Linhas visíveis (já filtradas pelo chip). */
  rows: ReceivableItem[]
  /** Todas as cobranças abertas do mês, para o botão do topo. */
  openRows: ReceivableItem[]
}

export function ReceivablesList({ rows, openRows }: Props) {
  const [dialog, setDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' })
  const open = (id: string) => setDialog({ open: true, id })

  const action = (r: ReceivableItem) =>
    r.situation === 'PAID' ? (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/financial/receivables/${r.id}/receipt`}>Recibo</Link>
      </Button>
    ) : (
      <Button type="button" variant="outline" size="sm" onClick={() => open(r.id)}>
        Registrar pagamento
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
                      <div className="font-medium">{r.tenant}</div>
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
                      <div className="font-medium">{r.tenant}</div>
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
      />
    </>
  )
}

function RegisterPaymentDialog({ open, initialId, items, onClose }: { open: boolean; initialId: string; items: ReceivableItem[]; onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(initialId)
  const item = items.find((i) => i.id === selected)
  const form = useForm<PayReceivableFormValues>({
    resolver: zodResolver(payReceivableSchema),
    defaultValues: { paid_date: todayLocal() },
  })

  async function onSubmit(values: PayReceivableFormValues) {
    if (!item) return
    setLoading(true)
    try {
      const result = await payReceivable(item.id, item.grossAmount, values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof PayReceivableFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success('Pagamento registrado. O recibo já está disponível.')
      onClose()
      router.refresh()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>Multa, juros e IRRF são calculados pela data informada.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="payment-select">
                Cobrança
              </label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="payment-select" aria-label="Cobrança">
                  <SelectValue placeholder="Escolha a cobrança" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.tenant} · vence {i.due} · {i.amount}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {item?.updatedTotal && (
              <p role="status" className="text-sm text-muted-foreground">
                Atrasada: {item.amount} com multa e juros viram {item.updatedTotal}.
              </p>
            )}
            <FormField
              control={form.control}
              name="paid_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do pagamento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !item}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar pagamento
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
