'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, RefreshCw, TrendingUp, XCircle } from 'lucide-react'

import { endLease, readjustLease, renewLease } from '@/app/leases/actions'
import {
  readjustSchema,
  renewSchema,
  type ReadjustFormValues,
  type RenewFormValues,
} from '@/lib/lease-schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

interface LeaseActionsProps {
  leaseId: string
  unitId: string
  currentEndDate?: string | null
}

type Open = 'renew' | 'readjust' | 'end' | null

export function LeaseActions({ leaseId, unitId, currentEndDate }: LeaseActionsProps) {
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setOpen('renew')}>
        <RefreshCw className="mr-2 h-4 w-4" /> Renovar
      </Button>
      <Button variant="outline" onClick={() => setOpen('readjust')}>
        <TrendingUp className="mr-2 h-4 w-4" /> Reajustar
      </Button>
      <Button variant="destructive" onClick={() => setOpen('end')}>
        <XCircle className="mr-2 h-4 w-4" /> Encerrar
      </Button>

      <RenewDialog open={open === 'renew'} onClose={close} leaseId={leaseId} currentEndDate={currentEndDate} />
      <ReadjustDialog open={open === 'readjust'} onClose={close} leaseId={leaseId} />
      <EndDialog open={open === 'end'} onClose={close} leaseId={leaseId} unitId={unitId} />
    </div>
  )
}

function RenewDialog({ open, onClose, leaseId, currentEndDate }: { open: boolean; onClose: () => void; leaseId: string; currentEndDate?: string | null }) {
  const [loading, setLoading] = useState(false)
  const form = useForm<RenewFormValues>({
    resolver: zodResolver(renewSchema),
    defaultValues: { new_end_date: '', rent_amount: '', payment_day: '' },
  })

  async function onSubmit(values: RenewFormValues) {
    setLoading(true)
    try {
      const result = await renewLease(leaseId, values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof RenewFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success('Contrato renovado!')
      form.reset()
      onClose()
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
          <DialogTitle>Renovar contrato</DialogTitle>
          <DialogDescription>
            {currentEndDate
              ? `Fim atual: ${new Date(currentEndDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}. A nova data deve ser posterior.`
              : 'Informe a nova data final.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="new_end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova data final *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rent_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Novo aluguel (R$)</FormLabel>
                    <FormControl><Input inputMode="decimal" placeholder="manter" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia de vencimento</FormLabel>
                    <FormControl><Input inputMode="numeric" placeholder="manter" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Renovar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ReadjustDialog({ open, onClose, leaseId }: { open: boolean; onClose: () => void; leaseId: string }) {
  const [loading, setLoading] = useState(false)
  const form = useForm<ReadjustFormValues>({
    resolver: zodResolver(readjustSchema),
    defaultValues: { percentage: '', applied_at: new Date().toISOString().split('T')[0], index_name: '', notes: '' },
  })

  async function onSubmit(values: ReadjustFormValues) {
    setLoading(true)
    try {
      const result = await readjustLease(leaseId, values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof ReadjustFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success('Reajuste aplicado! Cobranças já geradas não mudam.')
      form.reset()
      onClose()
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
          <DialogTitle>Reajustar aluguel</DialogTitle>
          <DialogDescription>O novo valor vale para as próximas cobranças; as já geradas não mudam.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Percentual (%) *</FormLabel>
                    <FormControl><Input inputMode="decimal" placeholder="5,5" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="applied_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aplicado em *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="index_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Índice</FormLabel>
                  <FormControl><Input placeholder="IGPM, IPCA..." {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Aplicar reajuste
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function EndDialog({ open, onClose, leaseId, unitId }: { open: boolean; onClose: () => void; leaseId: string; unitId: string }) {
  const [loading, setLoading] = useState(false)

  async function confirm() {
    setLoading(true)
    try {
      const result = await endLease(leaseId, unitId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      const canceled = result.data?.payments_canceled ?? 0
      const review = result.data?.payments_need_review ?? 0
      toast.success(canceled > 0 ? `Contrato encerrado. ${canceled} cobrança(s) futura(s) cancelada(s).` : 'Contrato encerrado.')
      if (review > 0) toast.warning(`${review} cobrança(s) futura(s) já emitida(s) foram mantidas e precisam de decisão manual.`)
      if (result.data?.payments_error) toast.error(`Falha ao cancelar cobranças futuras: ${result.data.payments_error}`)
      onClose()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar contrato?</AlertDialogTitle>
          <AlertDialogDescription>
            O contrato será encerrado hoje e a unidade fica livre para um novo contrato. Cobranças futuras pendentes sem
            cobrança emitida serão canceladas; as pagas e as vencidas permanecem.
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
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar encerramento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
