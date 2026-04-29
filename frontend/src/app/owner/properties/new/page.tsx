"use client"

import { useFormStatus } from "react-dom"
import { useActionState } from "react"
import { createPropertyAction } from "./actions"
import { Button, Card, Input, Select, Label, ListBox, TextField, FieldError } from "@heroui/react"
import { useRouter } from "next/navigation"

const PROPERTY_TYPES = [
  { value: "RESIDENTIAL", label: "Residencial" },
  { value: "SINGLE", label: "Único" },
]

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <Button type="submit" isPending={pending} className="bg-primary text-primary-foreground">
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
            placeholder="Selecione o tipo do imóvel"
            isRequired
          >
            <Label>Tipo</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={PROPERTY_TYPES}>
                {(type) => (
                  <ListBox.Item id={type.value} textValue={type.label}>
                    {type.label}
                  </ListBox.Item>
                )}
              </ListBox>
            </Select.Popover>
          </Select>

          <TextField name="name" isRequired isInvalid={!!state?.errors?.name}>
            <Label>Nome</Label>
            <Input placeholder="Ex: Apartamento Centro" />
            <FieldError>{state?.errors?.name?.[0]}</FieldError>
          </TextField>

          <TextField name="address_line" isInvalid={!!state?.errors?.address_line}>
            <Label>Endereço</Label>
            <Input placeholder="Rua, número, complemento" />
            <FieldError>{state?.errors?.address_line?.[0]}</FieldError>
          </TextField>

          <div className="grid grid-cols-2 gap-4">
            <TextField name="city" isInvalid={!!state?.errors?.city}>
              <Label>Cidade</Label>
              <Input placeholder="Cidade" />
              <FieldError>{state?.errors?.city?.[0]}</FieldError>
            </TextField>
            <TextField name="state" isInvalid={!!state?.errors?.state}>
              <Label>Estado</Label>
              <Input placeholder="UF" maxLength={2} />
              <FieldError>{state?.errors?.state?.[0]}</FieldError>
            </TextField>
          </div>

          {state?.errors?._form && (
            <div className="text-danger text-sm">
              {state.errors._form}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" isPending={isPending} className="bg-primary text-primary-foreground">
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