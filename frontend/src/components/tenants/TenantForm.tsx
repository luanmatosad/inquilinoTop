'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { tenantSchema, type TenantFormValues } from '@/lib/schemas'
import { maskCpfCnpj, maskPhone } from '@/lib/masks'
import { preserveAddress } from '@/lib/tenant-form'
import { createTenant, updateTenant } from '@/app/tenants/actions'

export interface TenantFormData {
  id: string
  name: string
  person_type?: 'PF' | 'PJ'
  email?: string | null
  phone?: string | null
  document?: string | null
  postal_code?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  notes?: string | null
}

interface TenantFormProps {
  initialData?: TenantFormData
  onSuccess?: () => void
  onCancel?: () => void
}

function toDefaults(t?: TenantFormData): TenantFormValues {
  return {
    name: t?.name ?? '',
    person_type: t?.person_type ?? 'PF',
    email: t?.email ?? '',
    phone: maskPhone(t?.phone),
    document: maskCpfCnpj(t?.document),
    notes: t?.notes ?? '',
  }
}

const TYPE_OPTIONS = [
  { value: 'PF', label: 'Pessoa física' },
  { value: 'PJ', label: 'Empresa' },
] as const

/**
 * Formulário rápido do canvas: nome e contato bastam. Não mostra endereço, mas a edição devolve o
 * endereço já gravado, porque o backend trata o PUT como substituição total (ver preserveAddress).
 */
export function TenantForm({ initialData, onSuccess, onCancel }: TenantFormProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: toDefaults(initialData),
  })

  const isCompany = form.watch('person_type') === 'PJ'

  async function onSubmit(values: TenantFormValues) {
    setLoading(true)
    try {
      const result = initialData
        ? await updateTenant(initialData.id, preserveAddress(values, initialData))
        : await createTenant(values)

      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof TenantFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success(initialData ? 'Inquilino atualizado com sucesso!' : 'Inquilino criado com sucesso!')
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
        <FormField
          control={form.control}
          name="person_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de inquilino</FormLabel>
              <RadioGroup
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  form.setValue('document', '')
                }}
                className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
              >
                {TYPE_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex h-7 cursor-pointer items-center justify-center rounded-md text-sm font-medium text-muted-foreground has-[[data-state=checked]]:bg-background has-[[data-state=checked]]:text-foreground has-[[data-state=checked]]:shadow-xs"
                  >
                    <RadioGroupItem value={o.value} className="sr-only" />
                    {o.label}
                  </label>
                ))}
              </RadioGroup>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isCompany ? 'Razão social' : 'Nome completo'}</FormLabel>
              <FormControl>
                <Input placeholder={isCompany ? 'Empresa Ltda.' : 'Marina Souza'} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="document"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isCompany ? 'CNPJ' : 'CPF'}</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  placeholder={isCompany ? '00.000.000/0000-00' : '000.000.000-00'}
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(maskCpfCnpj(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="marina@email.com" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Celular (WhatsApp)</FormLabel>
              <FormControl>
                <Input
                  inputMode="tel"
                  placeholder="(11) 98888-1111"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(maskPhone(e.target.value))}
                />
              </FormControl>
              <FormDescription>É por aqui que você envia as cobranças.</FormDescription>
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
                <Textarea placeholder="Algo que vale lembrar" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onCancel?.()} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
            {initialData ? 'Salvar alterações' : 'Cadastrar inquilino'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
