"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { unitSchema, UnitFormValues } from "@/lib/schemas"
import { createUnit, updateUnit } from "@/app/properties/actions"

interface UnitFormProps {
  propertyId: string
  initialData?: UnitFormValues & { id: string }
  onSuccess?: () => void
  onCancel?: () => void
}

export function UnitForm({ propertyId, initialData, onSuccess, onCancel }: UnitFormProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: initialData || {
      label: "",
      floor: "",
      notes: "",
    },
  })

  async function onSubmit(data: UnitFormValues) {
    setLoading(true)
    try {
      if (initialData) {
        const result = await updateUnit(initialData.id, propertyId, data)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Unidade atualizada com sucesso!")
          onSuccess?.()
        }
      } else {
        const result = await createUnit(propertyId, data)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Unidade criada com sucesso!")
          onSuccess?.()
        }
      }
    } catch (error) {
      toast.error("Ocorreu um erro inesperado.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Identificação (Label)</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Apto 101, Sala 3B" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="floor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Andar (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Ex: 1º Andar, Térreo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações (Opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Detalhes adicionais..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
