'use client'

import { useActionState, useEffect, useState } from 'react'
import { createTenant, updateTenant, type TenantActionState } from '@/app/tenants/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface Tenant {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  document?: string | null
  is_active: boolean
}

interface TenantFormProps {
  initialData?: Tenant
  onSuccess?: () => void
  onCancel?: () => void
}

export function TenantForm({ initialData, onSuccess, onCancel }: TenantFormProps) {
  const [state, formAction, isPending] = useActionState(
    initialData 
      ? updateTenant.bind(null, initialData.id) 
      : createTenant,
    null
  )

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
      <div className="space-y-2">
        <Label htmlFor="name">Nome Completo *</Label>
        <Input
          id="name"
          name="name"
          defaultValue={initialData?.name}
          required
          placeholder="Ex: João da Silva"
        />
        {state?.fieldErrors?.name && (
          <p className="text-sm text-red-500">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={initialData?.email || ''}
          placeholder="joao@email.com"
        />
        {state?.fieldErrors?.email && (
          <p className="text-sm text-red-500">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={initialData?.phone || ''}
            placeholder="(11) 99999-9999"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="document">CPF/Documento</Label>
          <Input
            id="document"
            name="document"
            defaultValue={initialData?.document || ''}
            placeholder="000.000.000-00"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData ? 'Salvar Alterações' : 'Cadastrar Inquilino'}
        </Button>
      </div>
    </form>
  )
}
