"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createLeaseAction, getUnitsForForm, getTenantsForForm } from "./actions"
import { Button, Card, Input, Select, Label, ListBox, TextField, FieldError } from "@heroui/react"

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
            placeholder="Selecione a unidade"
            isRequired
            isInvalid={!!errors.unit_id}
          >
            <Label>Unidade</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={units}>
                {(unit) => (
                  <ListBox.Item id={unit.id} textValue={unit.label}>
                    {unit.label}
                  </ListBox.Item>
                )}
              </ListBox>
            </Select.Popover>
            <FieldError>{errors.unit_id?.[0]}</FieldError>
          </Select>

          <Select
            name="tenant_id"
            placeholder="Selecione o inquilino"
            isRequired
            isInvalid={!!errors.tenant_id}
          >
            <Label>Inquilino</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={tenants}>
                {(tenant) => (
                  <ListBox.Item id={tenant.id} textValue={tenant.name}>
                    {tenant.name}
                  </ListBox.Item>
                )}
              </ListBox>
            </Select.Popover>
            <FieldError>{errors.tenant_id?.[0]}</FieldError>
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <TextField name="start_date" isRequired isInvalid={!!errors.start_date}>
              <Label>Data de Início</Label>
              <Input type="date" />
              <FieldError>{errors.start_date?.[0]}</FieldError>
            </TextField>
            
            <TextField name="end_date">
              <Label>Data de Término</Label>
              <Input type="date" />
            </TextField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField name="rent_amount" isRequired isInvalid={!!errors.rent_amount}>
              <Label>Valor do Aluguel (R$)</Label>
              <Input type="number" step="0.01" placeholder="0,00" />
              <FieldError>{errors.rent_amount?.[0]}</FieldError>
            </TextField>

            <TextField name="payment_day" isRequired isInvalid={!!errors.payment_day}>
              <Label>Dia de Vencimento</Label>
              <Input type="number" min="1" max="31" placeholder="5" />
              <FieldError>{errors.payment_day?.[0]}</FieldError>
            </TextField>
          </div>

          <TextField name="notes">
            <Label>Observações</Label>
            <Input placeholder="Observações adicionais..." />
          </TextField>

          {errors._form && (
            <div className="text-danger text-sm">
              {errors._form}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" isPending={isSubmitting} className="bg-primary text-primary-foreground">
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