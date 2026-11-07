'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { readjustLease, type ReadjustResult } from '@/app/leases/actions'
import { readjustSchema, type ReadjustFormValues } from '@/lib/lease-schemas'
import { parseDecimal } from '@/lib/form-utils'
import { previewReadjustment } from '@/lib/lease-form'
import { whatsappUrl } from '@/lib/whatsapp'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  /** Vem da URL (`?reajustar=1`). */
  open: boolean
  leaseId: string
  currentRent: number
  /** Índice do contrato, usado como padrão. */
  defaultIndex?: string | null
  /** Primeiro dia do próximo reajuste (YYYY-MM-DD), usado como vigência padrão. */
  defaultDate?: string
  tenantName?: string
  tenantPhone?: string | null
}

const NO_INDEX = 'NONE'
const todayLocal = () => new Date().toLocaleDateString('en-CA')

export function ReadjustSheet({ open, leaseId, currentRent, defaultIndex, defaultDate, tenantName, tenantPhone }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(open)
  const [prevOpen, setPrevOpen] = useState(open)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ result: ReadjustResult; newRent: number } | null>(null)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setIsOpen(open)
    if (open) setDone(null)
  }

  const form = useForm<ReadjustFormValues>({
    resolver: zodResolver(readjustSchema),
    defaultValues: { percentage: '', applied_at: defaultDate || todayLocal(), index_name: defaultIndex === 'IGP-M' || defaultIndex === 'IPCA' ? defaultIndex : '', notes: '' },
  })
  const pct = parseDecimal(form.watch('percentage') ?? '')
  const preview = previewReadjustment(currentRent, pct)

  function close() {
    setIsOpen(false)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('reajustar')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

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
      setDone({ result: result.data ?? {}, newRent: previewReadjustment(currentRent, parseDecimal(values.percentage)).newAmount })
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const wa = whatsappUrl(tenantPhone)
  const waText = done
    ? encodeURIComponent(`Olá${tenantName ? `, ${tenantName.split(' ')[0]}` : ''}! O aluguel foi reajustado para ${formatCurrency(done.newRent)}.`)
    : ''

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>Aplicar reajuste</SheetTitle>
          <SheetDescription>Aluguel atual: {formatCurrency(currentRent)}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          {done ? (
            <div className="flex flex-col gap-4">
              <p role="status" className="text-sm">
                Reajuste aplicado. Novo aluguel: {formatCurrency(done.newRent)}.{' '}
                {done.result.payments_updated ? `${done.result.payments_updated} cobrança(s) futura(s) atualizada(s).` : 'Nenhuma cobrança futura para atualizar.'}
              </p>
              {!!done.result.payments_need_review && (
                <p role="alert" className="text-sm text-destructive">
                  {done.result.payments_need_review} cobrança(s) já emitida(s) ficaram no valor antigo e precisam de revisão.
                </p>
              )}
              {done.result.payments_error && (
                <p role="alert" className="text-sm text-destructive">
                  O aluguel do contrato foi reajustado, mas não foi possível atualizar as cobranças futuras.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {wa && (
                  <Button asChild variant="outline">
                    <a href={`${wa}?text=${waText}`} target="_blank" rel="noreferrer">
                      Avisar pelo WhatsApp
                    </a>
                  </Button>
                )}
                <Button type="button" onClick={close}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentual (%)</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" placeholder="4,5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p aria-live="polite" className="rounded-md bg-muted p-3 text-sm">
                  {preview.increase > 0
                    ? `${formatCurrency(currentRent)} → ${formatCurrency(preview.newAmount)} (+${formatCurrency(preview.increase)})`
                    : 'Informe o percentual para ver o novo aluguel.'}
                </p>
                <FormField
                  control={form.control}
                  name="index_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Índice</FormLabel>
                      <Select value={field.value || NO_INDEX} onValueChange={(v) => field.onChange(v === NO_INDEX ? '' : v)}>
                        <FormControl>
                          <SelectTrigger aria-label="Índice">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="IGP-M">IGP-M</SelectItem>
                          <SelectItem value="IPCA">IPCA</SelectItem>
                          <SelectItem value={NO_INDEX}>Sem índice</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="applied_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vigência</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={close} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Aplicar reajuste
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
