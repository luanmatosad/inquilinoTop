'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { createLease } from '@/app/leases/actions'
import { leaseSchema, type LeaseFormValues } from '@/lib/lease-schemas'
import { maskCpfCnpj } from '@/lib/masks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Tenant {
  id: string
  name: string
  document?: string | null
}

interface Property {
  id: string
  name: string
  units: { id: string; label: string }[]
}

interface LeaseFormProps {
  unitId?: string
  tenants: Tenant[]
  properties?: Property[]
  onSuccess?: () => void
  onCancel?: () => void
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function LeaseForm({ unitId, tenants, properties = [], onSuccess, onCancel }: LeaseFormProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseSchema),
    defaultValues: {
      unit_id: unitId ?? '',
      tenant_id: '',
      start_date: today(),
      end_date: '',
      rent_amount: '',
      deposit_amount: '',
      payment_day: '5',
      late_fee_percent: '',
      daily_interest_percent: '',
      iptu_reimbursable: false,
      annual_iptu_amount: '',
      notes: '',
      generate_payments: true,
    },
  })

  const iptuReimbursable = form.watch('iptu_reimbursable')

  async function onSubmit(values: LeaseFormValues) {
    setLoading(true)
    try {
      const result = await createLease(values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof LeaseFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      const generated = result.data?.payments_generated ?? 0
      toast.success(generated > 0 ? `Contrato criado com ${generated} cobrança(s).` : 'Contrato criado com sucesso!')
      if (result.data?.payments_error) {
        toast.warning(`Algumas cobranças não foram geradas: ${result.data.payments_error}`)
      }
      onSuccess?.()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {!unitId && (
          <FormField
            control={form.control}
            name="unit_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidade *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma unidade" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {properties.flatMap((property) =>
                      (property.units ?? []).map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {property.name} - {unit.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="tenant_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Inquilino *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um inquilino" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} {tenant.document ? `(${maskCpfCnpj(tenant.document)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de início *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de fim (opcional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="rent_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aluguel (R$) *</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="1500,00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="deposit_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caução (R$)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="0,00" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="payment_day"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dia de vencimento *</FormLabel>
              <FormControl>
                <Input inputMode="numeric" className="max-w-28" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-border" />
          <span className="mx-3 flex-shrink text-xs text-muted-foreground uppercase tracking-wide">Encargos e IPTU</span>
          <div className="flex-grow border-t border-border" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="late_fee_percent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Multa por atraso (%)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="2" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="daily_interest_percent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Juros diários (%)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="0,033" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="iptu_reimbursable"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              </FormControl>
              <FormLabel className="font-normal cursor-pointer">IPTU reembolsável pelo inquilino</FormLabel>
            </FormItem>
          )}
        />

        {iptuReimbursable && (
          <FormField
            control={form.control}
            name="annual_iptu_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor anual do IPTU (R$)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="0,00" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Ex: fiador, condições especiais..." {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="generate_payments"
          render={({ field }) => (
            <FormItem className="flex items-start gap-3 space-y-0 rounded-md border p-3">
              <FormControl>
                <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              </FormControl>
              <div className="space-y-1">
                <FormLabel className="font-normal cursor-pointer">Gerar cobranças de aluguel</FormLabel>
                <FormDescription>
                  Uma por mês até a data de fim, no máximo 12. Sem data de fim, gera os 12 primeiros meses.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Contrato
          </Button>
        </div>
      </form>
    </Form>
  )
}
