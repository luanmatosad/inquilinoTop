'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateFinancialConfig } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FinancialConfig } from '@/types'
import { toast } from 'sonner'
import { SubmitButton } from '@/components/ui/submit-button'

export function FinancialForm({ initialData }: { initialData: FinancialConfig | null }) {
  const [state, action] = useActionState(updateFinancialConfig, null)
  const [provider, setProvider] = useState(initialData?.provider || 'MOCK')

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success)
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  const defaultLateFee = String(initialData?.config?.default_late_fee ?? '')
  const defaultInterest = String(initialData?.config?.default_interest ?? '')
  const asaasApiKey = String(initialData?.config?.api_key ?? '')

  return (
    <form action={action} className="space-y-8">
      {/* Defaults Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-on-surface border-b pb-2">Padrões de Cobrança</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="default_late_fee">Multa Padrão por Atraso (%)</Label>
            <Input 
              id="default_late_fee" 
              name="default_late_fee" 
              type="number"
              step="0.01"
              defaultValue={defaultLateFee} 
              placeholder="Ex: 2.0" 
            />
            <p className="text-xs text-on-surface-variant">Multa fixa aplicada um dia após o vencimento.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_interest">Juros Padrão de Mora (% ao mês)</Label>
            <Input 
              id="default_interest" 
              name="default_interest" 
              type="number"
              step="0.01"
              defaultValue={defaultInterest} 
              placeholder="Ex: 1.0" 
            />
             <p className="text-xs text-on-surface-variant">Juros cobrados proporcionalmente por dia de atraso.</p>
          </div>
        </div>
      </div>

      {/* Gateway Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-on-surface border-b pb-2">Meio de Recebimento</h2>
        
        <div className="space-y-2">
          <Label htmlFor="provider">Provedor Principal</Label>
          <select 
            id="provider" 
            name="provider" 
            value={provider}
            onChange={(e) => setProvider(e.target.value as typeof provider)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="MOCK">Manual / Direto (PIX, Transferência)</option>
            <option value="ASAAS">Asaas (Boletos e PIX Automático)</option>
          </select>
        </div>

        {provider === 'ASAAS' && (
          <div className="space-y-2 pt-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
             <Label htmlFor="asaas_api_key">Chave de API do Asaas</Label>
             <Input 
              id="asaas_api_key" 
              name="asaas_api_key" 
              type="password"
              defaultValue={asaasApiKey} 
              placeholder="Ex: $aact_..." 
            />
            <p className="text-xs text-on-surface-variant">Sua API Key de produção do Asaas.</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="pix_key">Sua Chave Pix (Para recebimentos manuais)</Label>
          <Input 
            id="pix_key" 
            name="pix_key" 
            defaultValue={initialData?.pix_key || ''} 
            placeholder="CPF, CNPJ, Email, Telefone ou Aleatória" 
          />
        </div>
      </div>

      {/* Bank Info Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-on-surface border-b pb-2">Dados Bancários</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="bank_code">Código do Banco</Label>
            <Input 
              id="bank_code" 
              name="bank_code" 
              defaultValue={initialData?.bank_info?.bank_code || ''} 
              placeholder="Ex: 341 (Itaú)" 
              maxLength={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="agency">Agência</Label>
            <Input 
              id="agency" 
              name="agency" 
              defaultValue={initialData?.bank_info?.agency || ''} 
              placeholder="Ex: 0001" 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">Conta</Label>
            <Input 
              id="account" 
              name="account" 
              defaultValue={initialData?.bank_info?.account || ''} 
              placeholder="Ex: 12345-6" 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_type">Tipo de Conta</Label>
            <select 
              id="account_type" 
              name="account_type" 
              defaultValue={initialData?.bank_info?.account_type || 'CC'}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="CC">Conta Corrente</option>
              <option value="CP">Conta Poupança</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="owner_name">Titular da Conta</Label>
            <Input 
              id="owner_name" 
              name="owner_name" 
              defaultValue={initialData?.bank_info?.owner_name || ''} 
              placeholder="Nome Completo ou Razão Social" 
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="document">CPF/CNPJ do Titular</Label>
            <Input 
              id="document" 
              name="document" 
              defaultValue={initialData?.bank_info?.document || ''} 
              placeholder="000.000.000-00" 
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <SubmitButton>Salvar Configurações</SubmitButton>
      </div>
    </form>
  )
}
