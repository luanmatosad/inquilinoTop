"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { propertySchema, PropertyFormValues } from "@/lib/schemas"
import { createProperty, updateProperty } from "@/app/properties/actions"

interface PropertyFormProps {
  initialData?: PropertyFormValues & { id: string }
}

export function PropertyForm({ initialData }: PropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: initialData || {
      name: "",
      type: "SINGLE", // Default to SINGLE
      address_line: "",
      city: "",
      state: "",
    },
  })

  async function onSubmit(data: PropertyFormValues) {
    setLoading(true)
    try {
      if (initialData) {
        const result = await updateProperty(initialData.id, data)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Imóvel atualizado com sucesso!")
          router.push(`/properties/${initialData.id}`)
          router.refresh()
        }
      } else {
        const result = await createProperty(data)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Imóvel criado com sucesso!")
          
          if (result.data) {
            if (data.type === "RESIDENTIAL") {
              // Se for residencial, redireciona para criar unidade
              router.push(`/properties/${result.data.id}?addUnit=true`)
            } else {
              // Se for single, já criou a unidade automática
              router.push(`/properties/${result.data.id}`)
            }
          }
          router.refresh()
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Imóvel</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Edifício Central ou Casa de Praia" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="SINGLE">Único (Casa/Loja)</SelectItem>
                  <SelectItem value="RESIDENTIAL">Residencial (Prédio/Condomínio)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                {field.value === "SINGLE" 
                  ? "Cria automaticamente uma unidade 'Unidade 01'." 
                  : "Permite adicionar múltiplas unidades posteriormente."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address_line"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Endereço</FormLabel>
              <FormControl>
                <Input placeholder="Rua, número, bairro" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input placeholder="Cidade" {...field} />
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
                <FormLabel>Estado</FormLabel>
                <FormControl>
                  <Input placeholder="UF" maxLength={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Salvar Alterações" : "Criar Imóvel"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
