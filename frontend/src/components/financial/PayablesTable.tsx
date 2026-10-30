'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { CheckCircle, Loader2, Undo2 } from 'lucide-react'

import { payExpense, payExpensesBatch, unpayExpense } from '@/app/financial/actions'
import { payExpenseSchema, type PayExpenseFormValues } from '@/lib/financial-schemas'
import type { PayableRow } from '@/data/financial/dal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge, fmtDate, money } from './shared'

const CATEGORY: Record<PayableRow['category'], string> = {
  ELECTRICITY: 'Energia',
  WATER: 'Água',
  CONDO: 'Condomínio',
  TAX: 'IPTU / Taxas',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outros',
}

const today = () => new Date().toISOString().split('T')[0]

interface PayablesTableProps {
  rows: PayableRow[]
  unitLabels: Record<string, string>
}

export function PayablesTable({ rows, unitLabels }: PayablesTableProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [paying, setPaying] = useState<PayableRow | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [unpaying, setUnpaying] = useState<PayableRow | null>(null)

  const payable = useMemo(() => rows.filter((r) => r.status !== 'PAID'), [rows])
  const allSelected = payable.length > 0 && payable.every((r) => selected.has(r.id))

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(payable.map((r) => r.id)))

  const done = () => {
    setSelected(new Set())
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-1 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground">Nenhuma despesa encontrada para os filtros.</p>
        <p className="text-sm text-muted-foreground">Use &quot;Nova despesa&quot; para lançar uma conta a pagar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm">{selected.size} selecionada(s)</span>
          <Button size="sm" onClick={() => setBatchOpen(true)}>
            <CheckCircle className="w-4 h-4 mr-2" /> Pagar selecionadas
          </Button>
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar todas as pendentes" />
              </TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.status !== 'PAID' && (
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Selecionar ${r.description}`} />
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{fmtDate(r.dueDate)}</TableCell>
                <TableCell className="font-medium">{r.description}</TableCell>
                <TableCell>{unitLabels[r.unitId] ?? '—'}</TableCell>
                <TableCell>{CATEGORY[r.category] ?? r.category}</TableCell>
                <TableCell className="text-right">
                  {money(r.paidAmount ?? r.amount)}
                  {r.paidAmount != null && r.paidAmount !== r.amount && (
                    <div className="text-xs text-muted-foreground">previsto {money(r.amount)}</div>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                  {r.paidDate && <div className="text-xs text-muted-foreground">em {fmtDate(r.paidDate)}</div>}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === 'PAID' ? (
                    <Button variant="ghost" size="sm" onClick={() => setUnpaying(r)}>
                      <Undo2 className="w-4 h-4 mr-1" /> Estornar
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

      <PayDialog row={paying} onClose={() => setPaying(null)} onDone={done} />
      <BatchDialog open={batchOpen} ids={[...selected]} onClose={() => setBatchOpen(false)} onDone={done} />
      <UnpayDialog row={unpaying} onClose={() => setUnpaying(null)} onDone={done} />
    </div>
  )
}

function PayDialog({ row, onClose, onDone }: { row: PayableRow | null; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const form = useForm<PayExpenseFormValues>({
    resolver: zodResolver(payExpenseSchema),
    defaultValues: { paid_date: today(), paid_amount: '' },
  })

  async function onSubmit(values: PayExpenseFormValues) {
    if (!row) return
    setLoading(true)
    try {
      const result = await payExpense(row.id, values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof PayExpenseFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success('Baixa registrada!')
      form.reset({ paid_date: today(), paid_amount: '' })
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
          <DialogTitle>Dar baixa</DialogTitle>
          <DialogDescription>
            {row ? `${row.description} · vencimento ${fmtDate(row.dueDate)} · ${money(row.amount)}` : ''}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="paid_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do pagamento *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paid_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor pago (R$)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder={row ? String(row.amount).replace('.', ',') : ''} {...field} value={field.value ?? ''} />
                  </FormControl>
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

function BatchDialog({ open, ids, onClose, onDone }: { open: boolean; ids: string[]; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const [failures, setFailures] = useState<{ id: string; error: string }[]>([])
  const form = useForm<PayExpenseFormValues>({
    resolver: zodResolver(payExpenseSchema),
    defaultValues: { paid_date: today(), paid_amount: '' },
  })

  async function onSubmit(values: PayExpenseFormValues) {
    setLoading(true)
    setFailures([])
    try {
      const result = await payExpensesBatch(ids, values)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.paid > 0) toast.success(`${result.paid} despesa(s) baixada(s).`)
      if (result.failed.length > 0) {
        setFailures(result.failed)
        toast.error(`${result.failed.length} despesa(s) não puderam ser baixadas.`)
        onDone()
        return
      }
      onClose()
      onDone()
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
          <DialogTitle>Pagar {ids.length} despesa(s)</DialogTitle>
          <DialogDescription>Cada despesa é baixada pelo seu valor previsto, na mesma data.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="paid_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do pagamento *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {failures.length > 0 && (
              <ul className="text-sm text-destructive list-disc pl-5">
                {failures.map((f) => (
                  <li key={f.id}>{f.error}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Fechar</Button>
              <Button type="submit" disabled={loading || ids.length === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function UnpayDialog({ row, onClose, onDone }: { row: PayableRow | null; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)

  async function confirm() {
    if (!row) return
    setLoading(true)
    try {
      const result = await unpayExpense(row.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Baixa estornada.')
      onClose()
      onDone()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Estornar a baixa?</AlertDialogTitle>
          <AlertDialogDescription>
            A despesa &quot;{row?.description}&quot; volta a pendente e a data e o valor pagos são apagados. A ação fica registrada na auditoria.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault()
              void confirm()
            }}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Estornar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
