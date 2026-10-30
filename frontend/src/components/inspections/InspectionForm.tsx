'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { createInspection } from '@/app/inspections/actions'
import { inspectionSchema, INSPECTION_TYPE_LABELS, type InspectionFormValues } from '@/lib/inspection-schemas'
import type { LeaseOption } from '@/lib/inspection-data'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  leases: LeaseOption[]
  leaseId?: string
  onCancel?: () => void
}

const today = () => new Date().toISOString().split('T')[0]

export function InspectionForm({ leases, leaseId, onCancel }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      lease_id: leaseId ?? '',
      type: 'ENTRY',
      inspected_at: today(),
      general_notes: '',
      copy_from_entry: false,
    },
  })
  const type = form.watch('type')

  async function onSubmit(values: InspectionFormValues) {
    setLoading(true)
    try {
      const result = await createInspection(values)
      if (result.error || !result.data) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof InspectionFormValues, { message: messages[0] })
        }
        toast.error(result.error ?? 'Erro ao criar o laudo.')
        return
      }
      toast.success('Laudo criado. Adicione os itens da vistoria.')
      router.push(`/inspections/${result.data.id}`)
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {!leaseId && (
          <FormField
            control={form.control}
            name="lease_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contrato *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione um contrato" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {leases.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(Object.keys(INSPECTION_TYPE_LABELS) as (keyof typeof INSPECTION_TYPE_LABELS)[]).map((k) => (
                      <SelectItem key={k} value={k}>{INSPECTION_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="inspected_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data da vistoria *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {type === 'EXIT' && (
          <FormField
            control={form.control}
            name="copy_from_entry"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3 rounded-md border p-3">
                <FormControl>
                  <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                </FormControl>
                <div className="space-y-1">
                  <FormLabel>Copiar itens do laudo de entrada</FormLabel>
                  <FormDescription>
                    Copia ambientes, itens e condições da entrada. Reavalie a condição de cada item na saída.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="general_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações gerais</FormLabel>
              <FormControl><Textarea rows={3} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar laudo
          </Button>
        </div>
      </form>
    </Form>
  )
}
