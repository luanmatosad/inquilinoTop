'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { endLease } from '@/app/leases/actions'
import { END_REASONS, endSchema, type EndFormValues } from '@/lib/lease-schemas'
import { formatDateBR } from '@/lib/date-format'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = {
  /** Vem da URL (`?encerrar=1`). */
  open: boolean
  leaseId: string
  unitId: string
  /** "Apartamento 302 · Ed. Aurora" para o título. */
  title: string
}

const todayLocal = () => new Date().toLocaleDateString('en-CA')

export function EndLeaseDialog({ open, leaseId, unitId, title }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(open)
  const [prevOpen, setPrevOpen] = useState(open)
  const [loading, setLoading] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setIsOpen(open)
  }

  const form = useForm<EndFormValues>({
    resolver: zodResolver(endSchema),
    defaultValues: { end_date: todayLocal(), reason: undefined },
  })
  const date = form.watch('end_date')

  function close() {
    setIsOpen(false)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('encerrar')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  async function onSubmit(values: EndFormValues) {
    setLoading(true)
    try {
      const result = await endLease(leaseId, values, unitId)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof EndFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      const canceled = result.data?.payments_canceled ?? 0
      const review = result.data?.payments_need_review ?? 0
      toast.success(canceled > 0 ? `Contrato encerrado. ${canceled} cobrança(s) futura(s) cancelada(s).` : 'Contrato encerrado.')
      if (review > 0) toast.warning(`${review} cobrança(s) já emitida(s) precisam de revisão manual.`)
      close()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const past = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') && date < todayLocal()

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar contrato</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de saída</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Motivo">
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(END_REASONS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-sm text-muted-foreground">
              {/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')
                ? `O contrato encerra em ${formatDateBR(date)} e as cobranças pendentes com vencimento depois dessa data são canceladas.`
                : 'Informe a data de saída.'}
            </p>
            {past && (
              <p role="alert" className="text-sm text-destructive">
                A data está no passado: cobranças com vencimento depois dela também serão canceladas.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={loading}>
                Voltar
              </Button>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Encerrar contrato
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
