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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { propertySchema, PropertyFormValues } from "@/lib/schemas"
import { maskCep } from "@/lib/masks"
import { createProperty, updateProperty, type Property } from "@/app/properties/actions"

interface PropertyFormProps {
  initialData?: PropertyFormValues & { id: string }
  /** Chamado depois de salvar com sucesso (o painel lateral fecha por aqui). */
  onSuccess?: (property?: Property) => void
  /** Padrão: voltar à página anterior. */
  onCancel?: () => void
}

// Ordem do canvas: Casa, Residencial, Comercial.
const TYPE_OPTIONS = [
  { value: "SINGLE", label: "Casa" },
  { value: "RESIDENTIAL", label: "Residencial" },
  { value: "COMMERCIAL", label: "Comercial" },
] as const

const emptyValues: PropertyFormValues = {
  name: "",
  type: "SINGLE",
  address_line: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  postal_code: "",
}

export function PropertyForm({ initialData, onSuccess, onCancel }: PropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: initialData
      ? {
          ...emptyValues,
          ...initialData,
          number: initialData.number ?? "",
          complement: initialData.complement ?? "",
          postal_code: maskCep(initialData.postal_code),
        }
      : emptyValues,
  })

  async function onSubmit(data: PropertyFormValues) {
    setLoading(true)
    try {
      if (initialData) {
        const result = await updateProperty(initialData.id, data)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Imóvel atualizado com sucesso!")
        router.refresh()
        onSuccess?.()
      } else {
        const result = await createProperty(data)
        if (result.error) {
          toast.error(result.error)
          return
        }
        // O backend cria "Unidade 01" sozinho quando o tipo é Casa.
        toast.success("Imóvel criado com sucesso!")
        router.refresh()
        onSuccess?.(result.data)
      }
    } catch {
      toast.error("Ocorreu um erro inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const textField = (
    name: "address_line" | "number" | "complement" | "neighborhood" | "city",
    label: string,
    placeholder: string,
    className?: string,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do imóvel</FormLabel>
              <FormControl>
                <Input placeholder="Ex.: Ed. Aurora" {...field} />
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
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid grid-cols-3 gap-2"
              >
                {TYPE_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:text-accent-foreground"
                  >
                    <RadioGroupItem value={o.value} className="sr-only" />
                    {o.label}
                  </label>
                ))}
              </RadioGroup>
              <FormDescription>
                Residencial e comercial têm várias unidades. Casa tem uma só, cadastrada junto com o imóvel.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {textField("address_line", "Endereço", "Rua, avenida...")}

        <div className="grid grid-cols-2 gap-3">
          {textField("number", "Número", "120")}
          {textField("complement", "Complemento (opcional)", "Bloco, torre")}
        </div>

        {textField("neighborhood", "Bairro", "Bairro")}

        <div className="grid grid-cols-[1fr_5rem] gap-3">
          {textField("city", "Cidade", "Cidade")}
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UF</FormLabel>
                <FormControl>
                  <Input
                    placeholder="AM"
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

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => (onCancel ? onCancel() : router.back())}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
            {initialData ? "Salvar alterações" : "Cadastrar imóvel"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
