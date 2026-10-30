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
import { maskCep } from "@/lib/masks"
import { createProperty, updateProperty } from "@/app/properties/actions"

interface PropertyFormProps {
  initialData?: PropertyFormValues & { id: string }
}

export function PropertyForm({ initialData }: PropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: initialData
      ? { ...initialData, postal_code: maskCep(initialData.postal_code) }
      : {
      name: "",
      type: "SINGLE", // Default to SINGLE
      address_line: "",
      neighborhood: "",
      city: "",
      state: "",
      postal_code: "",
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="postal_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <Input
                    placeholder="00000-000"
                    inputMode="numeric"
                    {...field}
                    value={field.value ?? ""}
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
                  <Input placeholder="Rua, número, complemento" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="neighborhood"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bairro</FormLabel>
              <FormControl>
                <Input placeholder="Bairro" {...field} value={field.value ?? ""} />
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
                  <Input placeholder="Cidade" {...field} value={field.value ?? ""} />
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
                  <Input
                    placeholder="UF"
                    maxLength={2}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
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
