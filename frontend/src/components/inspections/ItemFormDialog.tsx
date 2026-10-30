'use client'

import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { addItem, updateItem } from '@/app/inspections/actions'
import { CONDITIONS, CONDITION_LABELS, ROOM_SUGGESTIONS, itemSchema, type ItemFormValues } from '@/lib/inspection-schemas'
import type { InspectionItem } from '@/lib/inspection-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  inspectionId: string
  item?: InspectionItem
  defaultRoom?: string
  trigger: ReactNode
}

export function ItemFormDialog({ inspectionId, item, defaultRoom, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      room: item?.room ?? defaultRoom ?? '',
      item: item?.item ?? '',
      condition: item?.condition ?? 'GOOD',
      notes: item?.notes ?? '',
    },
  })

  async function onSubmit(values: ItemFormValues) {
    setLoading(true)
    try {
      const result = item ? await updateItem(inspectionId, item.id, values) : await addItem(inspectionId, values)
      if (result.error) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(name as keyof ItemFormValues, { message: messages[0] })
        }
        toast.error(result.error)
        return
      }
      toast.success(item ? 'Item atualizado.' : 'Item adicionado.')
      setOpen(false)
      if (!item) form.reset({ room: values.room, item: '', condition: 'GOOD', notes: '' })
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{item ? 'Editar item' : 'Novo item'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="room"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ambiente *</FormLabel>
                  <FormControl><Input list="room-suggestions" {...field} /></FormControl>
                  <datalist id="room-suggestions">
                    {ROOM_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="item"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item *</FormLabel>
                  <FormControl><Input placeholder="Ex.: Piso, parede, janela" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condição *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{CONDITION_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                  <FormControl><Textarea rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
