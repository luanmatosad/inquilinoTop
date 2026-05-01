"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { createPropertyAction } from "./actions"
import { Button, Card } from "@heroui/react"
import { useRouter } from "next/navigation"

const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" isDisabled={pending}>
      {pending ? "Criando..." : "Criar Imóvel"}
    </Button>
  )
}

export default function NewPropertyForm() {
  const router = useRouter()
  const [state, action] = useActionState(createPropertyAction, null)

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="p-6">
        <form action={action} className="space-y-6">
          <h1 className="text-2xl font-bold mb-6">Novo Imóvel</h1>

          <div className="space-y-1">
            <label className="text-sm font-medium">Tipo</label>
            <select name="type" required className={inputClass}>
              <option value="">Selecione o tipo do imóvel</option>
              <option value="RESIDENTIAL">Residencial</option>
              <option value="SINGLE">Único</option>
            </select>
            {state?.errors?.type && <p className="text-sm text-danger">{state.errors.type[0]}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Nome</label>
            <input name="name" placeholder="Ex: Apartamento Centro" required className={inputClass} />
            {state?.errors?.name && <p className="text-sm text-danger">{state.errors.name[0]}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Endereço</label>
            <input name="address_line" placeholder="Rua, número, complemento" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Cidade</label>
              <input name="city" placeholder="Cidade" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Estado</label>
              <input name="state" placeholder="UF" maxLength={2} className={inputClass} />
            </div>
          </div>

          {state?.errors?._form && (
            <div className="text-danger text-sm">
              {state.errors._form}
            </div>
          )}

          <div className="flex gap-4">
            <SubmitButton />
            <Button variant="outline" onPress={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
