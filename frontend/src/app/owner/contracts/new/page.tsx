"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createLeaseAction, getUnitsForForm, getTenantsForForm } from "./actions"
import { Button, Card } from "@heroui/react"

const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

interface Unit {
  id: string
  label: string
  property_id: string
}

interface Tenant {
  id: string
  name: string
}

interface FormErrors {
  unit_id?: string[]
  tenant_id?: string[]
  start_date?: string[]
  rent_amount?: string[]
  payment_day?: string[]
  _form?: string[]
}

export default function NewContractForm() {
  const router = useRouter()
  const [units, setUnits] = useState<Unit[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      getUnitsForForm(),
      getTenantsForForm()
    ]).then(([unitsData, tenantsData]) => {
      setUnits(unitsData)
      setTenants(tenantsData)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)

    try {
      const result = await createLeaseAction(formData)
      if (result.errors) {
        setErrors(result.errors as FormErrors)
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <h1 className="text-2xl font-bold mb-6">Novo Contrato de Locação</h1>

          <div className="space-y-1">
            <label className="text-sm font-medium">Unidade</label>
            <select name="unit_id" required className={inputClass}>
              <option value="">Selecione a unidade</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.label}</option>
              ))}
            </select>
            {errors.unit_id && <p className="text-sm text-danger">{errors.unit_id[0]}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Inquilino</label>
            <select name="tenant_id" required className={inputClass}>
              <option value="">Selecione o inquilino</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
            {errors.tenant_id && <p className="text-sm text-danger">{errors.tenant_id[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Data de Início</label>
              <input name="start_date" type="date" required className={inputClass} />
              {errors.start_date && <p className="text-sm text-danger">{errors.start_date[0]}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Data de Término</label>
              <input name="end_date" type="date" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Valor do Aluguel (R$)</label>
              <input name="rent_amount" type="number" step="0.01" placeholder="0,00" required className={inputClass} />
              {errors.rent_amount && <p className="text-sm text-danger">{errors.rent_amount[0]}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Dia de Vencimento</label>
              <input name="payment_day" type="number" min="1" max="31" placeholder="5" required className={inputClass} />
              {errors.payment_day && <p className="text-sm text-danger">{errors.payment_day[0]}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Observações</label>
            <input name="notes" placeholder="Observações adicionais..." className={inputClass} />
          </div>

          {errors._form && (
            <div className="text-danger text-sm">
              {errors._form}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" isDisabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar Contrato"}
            </Button>
            <Button variant="outline" onPress={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
