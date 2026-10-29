'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
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
import { createTenant, updateTenant } from '@/app/tenants/actions'
import { tenantSchema, type TenantFormValues } from '@/lib/schemas'
import { maskCep, maskCpfCnpj, maskPhone } from '@/lib/masks'

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
    postal_code: maskCep(t?.postal_code),
    address_line: t?.address_line ?? '',
    city: t?.city ?? '',
    state: t?.state ?? '',
    notes: t?.notes ?? '',
  }
}

export function TenantForm({ initialData, onSuccess, onCancel }: TenantFormProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: toDefaults(initialData),
  })

  const personType = form.watch('person_type')

  async function onSubmit(values: TenantFormValues) {
    setLoading(true)
    try {
      const result = initialData
        ? await updateTenant(initialData.id, values)
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="person_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo *</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    form.setValue('document', '')
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PF">Pessoa Física</SelectItem>
                    <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{personType === 'PJ' ? 'Razão social *' : 'Nome completo *'}</FormLabel>
                <FormControl>
                  <Input placeholder={personType === 'PJ' ? 'Ex: Empresa LTDA' : 'Ex: João da Silva'} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="document"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{personType === 'PJ' ? 'CNPJ' : 'CPF'}</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  placeholder={personType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(maskCpfCnpj(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="joao@email.com" {...field} value={field.value ?? ''} />
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
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(maskPhone(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="postal_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    placeholder="00000-000"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(maskCep(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address_line"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Endereço</FormLabel>
                <FormControl>
                  <Input placeholder="Rua, número, complemento" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input placeholder="Cidade" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <FormControl>
                  <Input
                    placeholder="UF"
                    maxLength={2}
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Detalhes adicionais..." {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? 'Salvar Alterações' : 'Cadastrar Inquilino'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
