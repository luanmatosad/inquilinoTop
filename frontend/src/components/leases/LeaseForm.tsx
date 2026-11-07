'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { createLease, updateLease } from '@/app/leases/actions'
import { leaseSchema, type LeaseFormValues } from '@/lib/lease-schemas'
import { dailyToMonthly } from '@/lib/interest'
import { MONTHS } from '@/lib/date-format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type LeaseUnitOption = { id: string; label: string; propertyName: string; referenceRent?: number | null }
export type LeaseTenantOption = { id: string; name: string }
/** Contrato atual no modo edição. */
export type LeaseEditData = {
  id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date?: string | null
  rent_amount: number
  payment_day?: number
  adjustment_index?: string | null
  adjustment_month?: number | null
  late_fee_percent?: number | null
  daily_interest_percent?: number | null
  iptu_reimbursable?: boolean
  annual_iptu_amount?: number | null
  notes?: string | null
}

type LeaseFormProps = {
  units: LeaseUnitOption[]
  tenants: LeaseTenantOption[]
  defaultUnitId?: string
  defaultTenantId?: string
  /** Presente = edição: unidade, inquilino e início viram texto. */
  lease?: LeaseEditData
  onSuccess?: () => void
  onCancel?: () => void
}

const NO_INDEX = 'NONE'
const dec = (n?: number | null) => (n == null || n === 0 ? '' : String(n).replace('.', ','))
const todayLocal = () => new Date().toLocaleDateString('en-CA')
const monthOf = (ymd: string) => (/^\d{4}-\d{2}/.test(ymd) ? String(Number(ymd.slice(5, 7))) : '')

export function LeaseForm({ units, tenants, defaultUnitId, defaultTenantId, lease, onSuccess, onCancel }: LeaseFormProps) {
  const [loading, setLoading] = useState(false)
  const editing = !!lease
  const initialUnit = units.find((u) => u.id === defaultUnitId)
  const [suggested, setSuggested] = useState(!editing && !!initialUnit?.referenceRent)
  const [monthTouched, setMonthTouched] = useState(editing)
  const [showCharges, setShowCharges] = useState(editing)

  const start = lease ? lease.start_date.slice(0, 10) : todayLocal()
  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseSchema),
    defaultValues: lease
      ? {
          unit_id: lease.unit_id,
          tenant_id: lease.tenant_id,
          start_date: start,
          end_date: lease.end_date ? lease.end_date.slice(0, 10) : '',
          rent_amount: dec(lease.rent_amount),
          payment_day: String(lease.payment_day ?? 5),
          adjustment_index: (lease.adjustment_index as LeaseFormValues['adjustment_index']) ?? '',
          adjustment_month: lease.adjustment_month ? String(lease.adjustment_month) : monthOf(start),
          late_fee_percent: dec(lease.late_fee_percent),
          monthly_interest_percent: dec(dailyToMonthly(lease.daily_interest_percent)),
          iptu_reimbursable: !!lease.iptu_reimbursable,
          annual_iptu_amount: dec(lease.annual_iptu_amount),
          notes: lease.notes ?? '',
        }
      : {
          unit_id: defaultUnitId ?? '',
          tenant_id: defaultTenantId ?? '',
          start_date: start,
          end_date: '',
          rent_amount: initialUnit?.referenceRent ? dec(initialUnit.referenceRent) : '',
          payment_day: '5',
          adjustment_index: '',
          adjustment_month: monthOf(start),
          late_fee_percent: '2',
          monthly_interest_percent: '1',
          iptu_reimbursable: false,
          annual_iptu_amount: '',
          notes: '',
          generate_payments: true,
        },
  })

  const iptuReimbursable = form.watch('iptu_reimbursable')
  const unit = units.find((u) => u.id === (lease?.unit_id ?? form.watch('unit_id')))
  const tenant = tenants.find((t) => t.id === lease?.tenant_id)

  async function onSubmit(values: LeaseFormValues) {
    setLoading(true)
    try {
      const result = lease ? await updateLease(lease.id, values) : await createLease(values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof LeaseFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      if (lease) {
        toast.success('Contrato atualizado.')
      } else {
        const generated = (result.data as { payments_generated?: number } | undefined)?.payments_generated ?? 0
        toast.success(generated > 0 ? `Contrato criado com ${generated} cobrança(s).` : 'Contrato criado com sucesso!')
        const err = (result.data as { payments_error?: string } | undefined)?.payments_error
        if (err) toast.warning(`Algumas cobranças não foram geradas: ${err}`)
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {editing ? (
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="font-medium">{unit ? `${unit.label} · ${unit.propertyName}` : '—'}</div>
            <div className="text-muted-foreground">{tenant?.name ?? '—'} · desde {start.split('-').reverse().join('/')}</div>
          </div>
        ) : (
          <>
            <FormField
              control={form.control}
              name="unit_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(id) => {
                      field.onChange(id)
                      const ref = units.find((u) => u.id === id)?.referenceRent
                      if (ref && (suggested || !form.getValues('rent_amount'))) {
                        form.setValue('rent_amount', dec(ref))
                        setSuggested(true)
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Unidade">
                        <SelectValue placeholder="Selecione uma unidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.label} · {u.propertyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tenant_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inquilino</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Inquilino">
                        <SelectValue placeholder="Selecione um inquilino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="rent_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor do aluguel</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="1850,00"
                    {...field}
                    onChange={(e) => {
                      setSuggested(false)
                      field.onChange(e)
                    }}
                  />
                </FormControl>
                {suggested && <FormDescription>Sugerido pela unidade.</FormDescription>}
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
                <FormControl>
                  <Input inputMode="numeric" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!editing && (
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Início</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        if (!monthTouched) form.setValue('adjustment_month', monthOf(e.target.value))
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fim (opcional)</FormLabel>
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
            name="adjustment_index"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Índice de reajuste</FormLabel>
                <Select value={field.value || NO_INDEX} onValueChange={(v) => field.onChange(v === NO_INDEX ? '' : v)}>
                  <FormControl>
                    <SelectTrigger aria-label="Índice de reajuste">
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
            name="adjustment_month"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reajustar em</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={(v) => {
                    setMonthTouched(true)
                    field.onChange(v)
                  }}
                >
                  <FormControl>
                    <SelectTrigger aria-label="Reajustar em">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {showCharges ? (
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
              name="monthly_interest_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Juros (% ao mês)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="1" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Padrão: multa de 2% e juros de 1% ao mês.{' '}
            <button type="button" className="underline" onClick={() => setShowCharges(true)}>
              Alterar neste contrato
            </button>
          </p>
        )}

        <FormField
          control={form.control}
          name="iptu_reimbursable"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              </FormControl>
              <FormLabel className="cursor-pointer font-normal">IPTU reembolsável pelo inquilino</FormLabel>
            </FormItem>
          )}
        />

        {iptuReimbursable && (
          <FormField
            control={form.control}
            name="annual_iptu_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor anual do IPTU</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="1200,00" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!editing && (
          <FormField
            control={form.control}
            name="generate_payments"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3 space-y-0 rounded-md border p-3">
                <FormControl>
                  <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                </FormControl>
                <div className="space-y-1">
                  <FormLabel className="cursor-pointer font-normal">Gerar as cobranças dos próximos 12 meses</FormLabel>
                  <FormDescription>Uma por mês até o fim do contrato, no máximo 12.</FormDescription>
                </div>
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
                <Textarea placeholder="Ex: fiador, condições especiais" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? 'Salvar alterações' : 'Criar contrato'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
