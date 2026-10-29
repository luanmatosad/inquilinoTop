"use client"

import { useActionState } from "react"
import { createPropertyAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"

const PROPERTY_TYPES = [
  { value: "RESIDENTIAL", label: "Residencial" },
  { value: "SINGLE", label: "Único" },
]

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

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select name="type" required>
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Selecione o tipo do imóvel" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" placeholder="Ex: Apartamento Centro" required aria-invalid={!!state?.errors?.name} />
            {state?.errors?.name?.[0] && (
              <p className="text-sm text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address_line">Endereço</Label>
            <Input id="address_line" name="address_line" placeholder="Rua, número, complemento" aria-invalid={!!state?.errors?.address_line} />
            {state?.errors?.address_line?.[0] && (
              <p className="text-sm text-destructive">{state.errors.address_line[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" name="city" placeholder="Cidade" aria-invalid={!!state?.errors?.city} />
              {state?.errors?.city?.[0] && (
                <p className="text-sm text-destructive">{state.errors.city[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" name="state" placeholder="UF" maxLength={2} aria-invalid={!!state?.errors?.state} />
              {state?.errors?.state?.[0] && (
                <p className="text-sm text-destructive">{state.errors.state[0]}</p>
              )}
            </div>
          </div>

          {state?.errors?._form && (
            <div className="text-destructive text-sm">
              {state.errors._form}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={isPending}>
              Criar Imóvel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}