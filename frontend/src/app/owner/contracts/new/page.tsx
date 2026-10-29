"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createLeaseAction, getUnitsForForm, getTenantsForForm } from "./actions"
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

          <div className="space-y-2">
            <Label htmlFor="unit_id">Unidade</Label>
            <Select name="unit_id" required>
              <SelectTrigger id="unit_id" className="w-full" aria-invalid={!!errors.unit_id}>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.unit_id?.[0] && (
              <p className="text-sm text-destructive">{errors.unit_id[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant_id">Inquilino</Label>
            <Select name="tenant_id" required>
              <SelectTrigger id="tenant_id" className="w-full" aria-invalid={!!errors.tenant_id}>
                <SelectValue placeholder="Selecione o inquilino" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tenant_id?.[0] && (
              <p className="text-sm text-destructive">{errors.tenant_id[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Data de Início</Label>
              <Input id="start_date" name="start_date" type="date" required aria-invalid={!!errors.start_date} />
              {errors.start_date?.[0] && (
                <p className="text-sm text-destructive">{errors.start_date[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Data de Término</Label>
              <Input id="end_date" name="end_date" type="date" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rent_amount">Valor do Aluguel (R$)</Label>
              <Input
                id="rent_amount"
                name="rent_amount"
                type="number"
                step="0.01"
                placeholder="0,00"
                required
                aria-invalid={!!errors.rent_amount}
              />
              {errors.rent_amount?.[0] && (
                <p className="text-sm text-destructive">{errors.rent_amount[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_day">Dia de Vencimento</Label>
              <Input
                id="payment_day"
                name="payment_day"
                type="number"
                min="1"
                max="31"
                placeholder="5"
                required
                aria-invalid={!!errors.payment_day}
              />
              {errors.payment_day?.[0] && (
                <p className="text-sm text-destructive">{errors.payment_day[0]}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input id="notes" name="notes" placeholder="Observações adicionais..." />
          </div>

          {errors._form && (
            <div className="text-destructive text-sm">
              {errors._form}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              Criar Contrato
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