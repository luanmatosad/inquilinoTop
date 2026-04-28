'use client'

import { useActionState, useEffect } from 'react'
import { updateProfile } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserProfile } from '@/types'
import { toast } from 'sonner'
import { SubmitButton } from '@/components/ui/submit-button'

export function ProfileForm({ initialData }: { initialData: UserProfile | null }) {
  const [state, action] = useActionState(updateProfile, null)

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success)
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nome Completo / Razão Social</Label>
          <Input 
            id="full_name" 
            name="full_name" 
            defaultValue={initialData?.full_name || ''} 
            placeholder="João da Silva" 
            required 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="person_type">Tipo de Pessoa</Label>
          <select 
            id="person_type" 
            name="person_type" 
            defaultValue={initialData?.person_type || 'PF'}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="PF">Pessoa Física (PF)</option>
            <option value="PJ">Pessoa Jurídica (PJ)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="document">CPF / CNPJ</Label>
          <Input 
            id="document" 
            name="document" 
            defaultValue={initialData?.document || ''} 
            placeholder="000.000.000-00" 
            required 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input 
            id="phone" 
            name="phone" 
            defaultValue={initialData?.phone || ''} 
            placeholder="(00) 00000-0000" 
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address_line">Endereço (Rua, Número, Complemento)</Label>
          <Input 
            id="address_line" 
            name="address_line" 
            defaultValue={initialData?.address_line || ''} 
            placeholder="Rua das Flores, 123" 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input 
            id="city" 
            name="city" 
            defaultValue={initialData?.city || ''} 
            placeholder="São Paulo" 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">Estado (UF)</Label>
          <Input 
            id="state" 
            name="state" 
            defaultValue={initialData?.state || ''} 
            placeholder="SP" 
            maxLength={2}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <SubmitButton>Salvar Alterações</SubmitButton>
      </div>
    </form>
  )
}
