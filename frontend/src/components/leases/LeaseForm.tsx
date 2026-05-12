'use client'

import { useActionState, useEffect, useState } from 'react'
import { createLease } from '@/app/leases/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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

export function LeaseForm({ unitId, tenants, properties = [], onSuccess, onCancel }: LeaseFormProps) {
  const [state, formAction, isPending] = useActionState(createLease, null)
  const [iptuReimbursable, setIptuReimbursable] = useState(false)

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success)
      onSuccess?.()
    }
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      {unitId ? (
        <input type="hidden" name="unit_id" value={unitId} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="unit_id">Unidade *</Label>
          <Select name="unit_id" required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma unidade" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                property.units && property.units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {property.name} - {unit.label}
                  </SelectItem>
                ))
              ))}
            </SelectContent>
          </Select>
          {state?.fieldErrors?.unit_id && (
            <p className="text-sm text-red-500">{state.fieldErrors.unit_id[0]}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="tenant_id">Inquilino *</Label>
        <Select name="tenant_id" required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um inquilino" />
          </SelectTrigger>
          <SelectContent>
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name} {tenant.document ? `(${tenant.document})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state?.fieldErrors?.tenant_id && (
          <p className="text-sm text-red-500">{state.fieldErrors.tenant_id[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Data de Início *</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={new Date().toISOString().split('T')[0]}
          />
          {state?.fieldErrors?.start_date && (
            <p className="text-sm text-red-500">{state.fieldErrors.start_date[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">Data de Fim (Opcional)</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rent_amount">Valor do Aluguel (R$) *</Label>
          <Input
            id="rent_amount"
            name="rent_amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
          />
          {state?.fieldErrors?.rent_amount && (
            <p className="text-sm text-red-500">{state.fieldErrors.rent_amount[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="deposit_amount">Caução (R$) (Opcional)</Label>
          <Input
            id="deposit_amount"
            name="deposit_amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="payment_day">Dia de Vencimento *</Label>
          <Input
            id="payment_day"
            name="payment_day"
            type="number"
            min="1"
            max="31"
            required
            defaultValue="5"
          />
          {state?.fieldErrors?.payment_day && (
            <p className="text-sm text-red-500">{state.fieldErrors.payment_day[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract_url">URL do Contrato</Label>
          <Input
            id="contract_url"
            name="contract_url"
            type="url"
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-gray-200" />
        <span className="mx-3 flex-shrink text-xs text-gray-400 uppercase tracking-wide">Encargos e IPTU</span>
        <div className="flex-grow border-t border-gray-200" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="late_fee_percent">Multa por Atraso (%)</Label>
          <Input
            id="late_fee_percent"
            name="late_fee_percent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="Ex: 2.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="daily_interest_percent">Juros Diários (%)</Label>
          <Input
            id="daily_interest_percent"
            name="daily_interest_percent"
            type="number"
            step="0.001"
            min="0"
            max="100"
            placeholder="Ex: 0.033"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="iptu_reimbursable"
          name="iptu_reimbursable"
          type="checkbox"
          checked={iptuReimbursable}
          onChange={(e) => setIptuReimbursable(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <Label htmlFor="iptu_reimbursable" className="cursor-pointer font-normal">
          IPTU reembolsável pelo inquilino
        </Label>
      </div>

      {iptuReimbursable && (
        <div className="space-y-2">
          <Label htmlFor="annual_iptu_amount">Valor Anual do IPTU (R$)</Label>
          <Input
            id="annual_iptu_amount"
            name="annual_iptu_amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Ex: Caução de 3 meses, fiador, etc."
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar Contrato
        </Button>
      </div>
    </form>
  )
}
