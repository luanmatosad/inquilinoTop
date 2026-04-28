"use server"

import { goFetch } from '@/lib/go/server-auth'
import { createLease, getActiveLeaseForUnit } from "@/data/owner/contracts-dal"
import { redirect } from "next/navigation"

interface Unit {
  id: string
  label: string
  property_id: string
}

interface Property {
  id: string
  units: { id: string; label?: string }[]
}

interface Tenant {
  id: string
  name: string
}

export async function getUnitsForForm(): Promise<Unit[]> {
  try {
    const properties = await goFetch<Property[]>('/api/v1/properties')
    return (properties ?? []).flatMap(p =>
      (p.units ?? []).map(u => ({ id: u.id, label: u.label ?? u.id, property_id: p.id }))
    )
  } catch {
    return []
  }
}

export async function getTenantsForForm(): Promise<Tenant[]> {
  try {
    const tenants = await goFetch<Tenant[]>('/api/v1/tenants')
    return tenants ?? []
  } catch {
    return []
  }
}

interface FormState {
  errors?: Record<string, string[]>
}

export async function createLeaseAction(formData: FormData): Promise<FormState> {
  const unit_id = formData.get("unit_id") as string
  const tenant_id = formData.get("tenant_id") as string
  const start_date = formData.get("start_date") as string
  const end_date = formData.get("end_date") as string
  const rent_amount = formData.get("rent_amount") as string
  const payment_day = formData.get("payment_day") as string
  const notes = formData.get("notes") as string

  const errors: Record<string, string[]> = {}

  if (!unit_id) errors.unit_id = ["Unidade é obrigatória"]
  if (!tenant_id) errors.tenant_id = ["Inquilino é obrigatório"]
  if (!start_date) errors.start_date = ["Data de início é obrigatória"]
  if (!rent_amount) errors.rent_amount = ["Valor do aluguel é obrigatório"]
  if (!payment_day) errors.payment_day = ["Dia de pagamento é obrigatório"]

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  try {
    const existingLease = await getActiveLeaseForUnit(unit_id)
    if (existingLease) {
      return { errors: { unit_id: ["Esta unidade já possui um contrato ativo"] } }
    }

    await createLease({
      unit_id,
      tenant_id,
      start_date,
      end_date: end_date || undefined,
      rent_amount: Number(rent_amount),
      payment_day: Number(payment_day),
      notes: notes || undefined,
    })
  } catch (error) {
    console.error("Error creating lease:", error)
    return { errors: { _form: ["Erro ao criar contrato. Tente novamente."] } }
  }

  redirect("/owner/contracts")
}
