"use client"

import { useFormState } from "react"
import { useFormStatus } from "react-dom"
import { useActionState } from "react"
import { createPropertyAction } from "./actions"
import { Button, Card, Input, Select, SelectItem } from "@heroui/react"
import { useRouter } from "next/navigation"

const PROPERTY_TYPES = [
  { value: "RESIDENTIAL", label: "Residencial" },
  { value: "SINGLE", label: "Único" },
]

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <Button type="submit" isLoading={pending} color="primary">
      Criar Imóvel
    </Button>
  )
}

export default function NewPropertyForm() {
  const router = useRouter()
  const [state, action, isPending] = useActionState(createPropertyAction, null)

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="p-6">
        <form action={action} className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-6">Novo Imóvel</h1>
          </div>

          <Select
            name="type"
            label="Tipo"
            placeholder="Selecione o tipo do imóvel"
            isRequired
          >
            {PROPERTY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </Select>

          <Input
            name="name"
            label="Nome"
            placeholder="Ex: Apartamento Centro"
            isRequired
          />

          <Input
            name="address_line"
            label="Endereço"
            placeholder="Rua, número, complemento"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="city"
              label="Cidade"
              placeholder="Cidade"
            />
            <Input
              name="state"
              label="Estado"
              placeholder="UF"
              maxLength={2}
            />
          </div>

          {state?.errors?._form && (
            <div className="text-danger text-sm">
              {state.errors._form}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" isLoading={isPending} color="primary">
              Criar Imóvel
            </Button>
            <Button 
              variant="outline" 
              onPress={() => router.back()}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}