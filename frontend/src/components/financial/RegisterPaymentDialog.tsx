'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { payReceivable } from '@/app/financial/actions'
import {
  PAYMENT_METHODS,
  registerPaymentSchemaFor,
  type RegisterPaymentValues,
} from '@/lib/financial-schemas'
import { parseDecimal } from '@/lib/form-utils'
import { PAYMENT_METHOD_LABEL } from '@/lib/receivable-detail'
import { formatCurrency } from '@/lib/utils'
import type { ReceivableItem } from '@/components/financial/ReceivablesList'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const todayLocal = () => new Date().toLocaleDateString('en-CA')

type Props = {
  open: boolean
  /** Cobrança escolhida ao abrir. */
  initialId: string
  /** Cobranças abertas que podem ser escolhidas. */
  items: ReceivableItem[]
  onClose: () => void
  onDone: () => void
}

/** Registra o pagamento: data, forma, desconto e observação. O valor é sempre o total devido (sem pagamento parcial). */
export function RegisterPaymentDialog({ open, initialId, items, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(initialId)
  const item = items.find((i) => i.id === selected)
  const totalRef = useRef(item?.totalDue ?? 0)
  totalRef.current = item?.totalDue ?? 0

  const form = useForm<RegisterPaymentValues>({
    // O limite do desconto depende da cobrança escolhida, lida no momento da validação.
    resolver: (values, context, options) => zodResolver(registerPaymentSchemaFor(totalRef.current))(values, context, options),
    defaultValues: { paid_date: todayLocal(), payment_method: 'PIX', discount_amount: '', payment_note: '' },
  })

  const discount = parseDecimal(form.watch('discount_amount') ?? '')
  const toReceive = item ? Math.max(0, item.totalDue - (Number.isFinite(discount) ? discount : 0)) : 0

  async function onSubmit(values: RegisterPaymentValues) {
    if (!item) return
    setLoading(true)
    try {
      const result = await payReceivable(item.id, item.grossAmount, values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof RegisterPaymentValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success('Pagamento registrado. O recibo já está disponível.')
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
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>Para quem pagou fora do link ou em dinheiro. Multa, juros e IRRF são calculados pela data informada.</DialogDescription>
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
            <div className="grid grid-cols-2 gap-4">
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
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de pagamento</FormLabel>
                    <Select value={field.value ?? 'PIX'} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger aria-label="Forma de pagamento">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {PAYMENT_METHOD_LABEL[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="discount_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Desconto (opcional)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="0,00" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Abate do valor da cobrança. Fica anotado no recibo.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ex.: pagou em dinheiro na portaria" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-sm text-muted-foreground">
              Total a receber: <strong>{formatCurrency(toReceive)}</strong>. Saldo depois deste pagamento: {formatCurrency(0)}. A cobrança será marcada como paga e o recibo será gerado.
            </p>
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

/** Registrar pagamento no detalhe da cobrança, aberto por `?pagar=1`. */
export function RegisterPaymentPanel({ open, item }: { open: boolean; item: ReceivableItem }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(open)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setIsOpen(open)
  }

  function close() {
    setIsOpen(false)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('pagar')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <RegisterPaymentDialog
      key={isOpen ? 'open' : 'closed'}
      open={isOpen}
      initialId={item.id}
      items={[item]}
      onClose={close}
      onDone={() => router.refresh()}
    />
  )
}
