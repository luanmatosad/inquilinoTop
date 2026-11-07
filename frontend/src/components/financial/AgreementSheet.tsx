'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { createAgreement } from '@/app/financial/actions'
import { agreementSchemaFor, type AgreementFormValues } from '@/lib/financial-schemas'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  /** Vem da URL (`?acordo=1`). */
  open: boolean
  paymentId: string
  tenantName: string
  /** Hoje em YYYY-MM-DD (São Paulo); o novo vencimento precisa ser depois. */
  today: string
  /** Total atualizado de hoje (bruto, multa e juros). */
  total: number
}

export function AgreementSheet({ open, paymentId, tenantName, today, total }: Props) {
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

  const form = useForm<AgreementFormValues>({
    resolver: zodResolver(agreementSchemaFor(today)),
    defaultValues: { new_due_date: '', agreed_amount: String(total).replace('.', ','), note: '' },
  })

  function close() {
    setIsOpen(false)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('acordo')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  async function onSubmit(values: AgreementFormValues) {
    setLoading(true)
    try {
      const result = await createAgreement(paymentId, values, today)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof AgreementFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success('Acordo registrado.')
      close()
      router.refresh()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>Negociar atraso</SheetTitle>
          <SheetDescription>Registre o que você combinou com {tenantName}.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-md bg-muted p-3 text-sm">
                <span>Total hoje</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <FormField
                control={form.control}
                name="new_due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Novo vencimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agreed_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor a receber</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Edite se abateu multa ou juros.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observação</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Ex.: combinado por WhatsApp em 02/11" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-sm text-muted-foreground">O acordo fica registrado na linha do tempo da cobrança. O contrato não muda.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={close} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar acordo
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
