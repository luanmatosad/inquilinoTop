"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createLeaseAction, getUnitsForForm, getTenantsForForm } from "./actions"
import { Button, Card, Input, Select, SelectItem } from "@heroui/react"

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
          <div>
            <h1 className="text-2xl font-bold mb-6">Novo Contrato de Locação</h1>
          </div>

          <Select
            name="unit_id"
            label="Unidade"
            placeholder="Selecione a unidade"
            isRequired
            errorMessage={errors.unit_id?.[0]}
          >
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.label}
              </SelectItem>
            ))}
          </Select>

          <Select
            name="tenant_id"
            label="Inquilino"
            placeholder="Selecione o inquilino"
            isRequired
            errorMessage={errors.tenant_id?.[0]}
          >
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name}
              </SelectItem>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="start_date"
              type="date"
              label="Data de Início"
              isRequired
              errorMessage={errors.start_date?.[0]}
            />
            <Input
              name="end_date"
              type="date"
              label="Data de Término"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="rent_amount"
              type="number"
              step="0.01"
              label="Valor do Aluguel (R$)"
              placeholder="0,00"
              isRequired
              errorMessage={errors.rent_amount?.[0]}
            />
            <Input
              name="payment_day"
              type="number"
              min="1"
              max="31"
              label="Dia de Vencimento"
              placeholder="5"
              isRequired
              errorMessage={errors.payment_day?.[0]}
            />
          </div>

          <Input
            name="notes"
            label="Observações"
            placeholder="Observações adicionais..."
          />

          {errors._form && (
            <div className="text-danger text-sm">
              {errors._form}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" isLoading={isSubmitting} color="primary">
              Criar Contrato
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