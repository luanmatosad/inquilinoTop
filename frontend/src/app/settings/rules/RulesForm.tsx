'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseRulesForm, type FinancialRules, type RulesFormInput } from '@/lib/financial-rules'
import { saveFinancialRules } from './actions'

const text = (n: number) => String(n).replace('.', ',')

export function RulesForm({ rules }: { rules: FinancialRules }) {
  const [values, setValues] = useState<RulesFormInput>({
    late_fee_percent: text(rules.late_fee_percent),
    monthly_interest_percent: text(rules.monthly_interest_percent),
    default_adjustment_index: rules.default_adjustment_index,
    readjust_notice_days: String(rules.readjust_notice_days),
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FinancialRules, string>>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k: keyof RulesFormInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const parsed = parseRulesForm(values)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      const res = await saveFinancialRules(values)
      if ('error' in res) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error)
        return
      }
      toast.success('Regras salvas.')
    } catch {
      setFormError('Ocorreu um erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  const err = (k: keyof FinancialRules) =>
    errors[k] ? (
      <p id={`${k}-error`} role="alert" className="text-xs text-destructive">
        {errors[k]}
      </p>
    ) : null

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="late_fee_percent">Multa por atraso (%)</Label>
          <Input id="late_fee_percent" inputMode="decimal" value={values.late_fee_percent} onChange={set('late_fee_percent')} aria-invalid={!!errors.late_fee_percent} aria-describedby={errors.late_fee_percent ? 'late_fee_percent-error' : undefined} />
          {err('late_fee_percent')}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="monthly_interest_percent">Juros ao mês (%)</Label>
          <Input id="monthly_interest_percent" inputMode="decimal" value={values.monthly_interest_percent} onChange={set('monthly_interest_percent')} aria-invalid={!!errors.monthly_interest_percent} aria-describedby={errors.monthly_interest_percent ? 'monthly_interest_percent-error' : undefined} />
          {err('monthly_interest_percent')}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="default_adjustment_index">Índice de reajuste padrão</Label>
        <select
          id="default_adjustment_index"
          value={values.default_adjustment_index}
          onChange={set('default_adjustment_index')}
          className="flex h-11 w-full rounded-md border bg-background px-3 text-sm shadow-xs md:h-9 md:max-w-60"
        >
          <option value="IGP-M">IGP-M</option>
          <option value="IPCA">IPCA</option>
        </select>
        <p className="text-xs text-muted-foreground">Você revisa e aprova cada reajuste antes de valer.</p>
        {err('default_adjustment_index')}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="readjust_notice_days">Avisar quando faltar quantos dias para o reajuste</Label>
        <Input id="readjust_notice_days" inputMode="numeric" value={values.readjust_notice_days} onChange={set('readjust_notice_days')} className="w-28" aria-invalid={!!errors.readjust_notice_days} aria-describedby={errors.readjust_notice_days ? 'readjust_notice_days-error' : undefined} />
        <p className="text-xs text-muted-foreground">O aviso aparece em Hoje.</p>
        {err('readjust_notice_days')}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
