'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { payExpense, unpayExpense } from '@/app/financial/actions'
import { payExpenseSchema, type PayExpenseFormValues } from '@/lib/financial-schemas'
import type { Situation } from '@/lib/financial-overview'
import { SituationBadge } from '@/components/financial/SituationBadge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { plural } from '@/lib/property-format'

export type PayableItem = {
  id: string
  description: string
  where: string
  category: string
  due: string
  amount: string
  situation: Situation
}

const LABELS = { LATE: 'Atrasada', PAID: 'Paga', PENDING: 'A pagar' } as const
const todayLocal = () => new Date().toLocaleDateString('en-CA')

export function PayablesList({ rows }: { rows: PayableItem[] }) {
  const router = useRouter()
  const [paying, setPaying] = useState<PayableItem | null>(null)
  const [undoing, setUndoing] = useState<PayableItem | null>(null)

  async function undo() {
    if (!undoing) return
    const result = await unpayExpense(undoing.id)
    if (result.error) toast.error(result.error)
    else {
      toast.success('Pagamento desfeito.')
      router.refresh()
    }
    setUndoing(null)
  }

  const action = (r: PayableItem) =>
    r.situation === 'PAID' ? (
      <Button type="button" variant="ghost" size="sm" onClick={() => setUndoing(r)}>
        Desfazer pagamento
      </Button>
    ) : (
      <Button type="button" variant="outline" size="sm" onClick={() => setPaying(r)}>
        Dar baixa
      </Button>
    )

  return (
    <>
      {rows.length > 0 && (
        <>
          <Card className="hidden gap-0 overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-4">Despesa e imóvel</TableHead>
                  <TableHead>Categoria</TableHead>
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
                      <div className="font-medium">{r.description}</div>
                      <div className="text-sm text-muted-foreground">{r.where}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.category}</TableCell>
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
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">{plural(rows.length, 'despesa', 'despesas')}</div>
          </Card>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Card className="gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{r.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {r.where} · {r.category}
                      </div>
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

      <PayDialog key={paying?.id ?? 'closed'} item={paying} onClose={() => setPaying(null)} onDone={() => router.refresh()} />

      <AlertDialog open={!!undoing} onOpenChange={(o) => !o && setUndoing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer o pagamento?</AlertDialogTitle>
            <AlertDialogDescription>{undoing?.description} volta para “A pagar”.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={undo}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PayDialog({ item, onClose, onDone }: { item: PayableItem | null; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const form = useForm<PayExpenseFormValues>({
    resolver: zodResolver(payExpenseSchema),
    defaultValues: { paid_date: todayLocal(), paid_amount: '' },
  })

  async function onSubmit(values: PayExpenseFormValues) {
    if (!item) return
    setLoading(true)
    try {
      const result = await payExpense(item.id, values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof PayExpenseFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success('Baixa registrada.')
      onClose()
      onDone()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar baixa</DialogTitle>
          <DialogDescription>{item ? `${item.description} · ${item.amount}` : ''}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
            <FormField
              control={form.control}
              name="paid_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor pago (opcional)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="Vazio = valor da despesa" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar baixa
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
