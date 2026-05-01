"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { z } from "zod"

const leaseSchema = z.object({
  unit_id: z.string().uuid(),
  tenant_id: z.string().uuid({ message: "Selecione um inquilino." }),
  start_date: z.string().min(1, { message: "Data de início obrigatória." }),
  end_date: z.string().optional().or(z.literal("")),
  rent_amount: z.coerce.number().min(0.01, { message: "Valor do aluguel deve ser maior que zero." }),
  deposit_amount: z.coerce.number().optional(),
  payment_day: z.coerce.number().min(1).max(31, { message: "Dia de vencimento deve ser entre 1 e 31." }),
  notes: z.string().optional(),
  late_fee_percent: z.coerce.number().optional(),
  daily_interest_percent: z.coerce.number().optional(),
  iptu_reimbursable: z.boolean().optional(),
  annual_iptu_amount: z.coerce.number().optional(),
})

export type LeaseActionState = {
  error?: string
  success?: string
  fieldErrors?: {
    [key: string]: string[]
  }
} | null

interface Lease {
  id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date?: string
  rent_amount: number
  deposit_amount?: number
  payment_day: number
  status: string
  is_active: boolean
  created_at: string
}

export async function createLease(prevState: LeaseActionState, formData: FormData) {
  const rawData = {
    unit_id: formData.get("unit_id"),
    tenant_id: formData.get("tenant_id"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    rent_amount: formData.get("rent_amount"),
    deposit_amount: formData.get("deposit_amount"),
    payment_day: formData.get("payment_day"),
    notes: formData.get("notes"),
    late_fee_percent: formData.get("late_fee_percent"),
    daily_interest_percent: formData.get("daily_interest_percent"),
    iptu_reimbursable: formData.get("iptu_reimbursable"),
    annual_iptu_amount: formData.get("annual_iptu_amount"),
  }

  const validatedFields = leaseSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: "Erro de validação. Verifique os campos.",
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    }
  }

  try {
    await goFetch<Lease>("/api/v1/leases", {
      method: "POST",
      body: JSON.stringify({
        unit_id: validatedFields.data.unit_id,
        tenant_id: validatedFields.data.tenant_id,
        start_date: validatedFields.data.start_date,
        end_date: validatedFields.data.end_date || null,
        rent_amount: validatedFields.data.rent_amount,
        deposit_amount: validatedFields.data.deposit_amount || null,
        payment_day: validatedFields.data.payment_day,
        late_fee_percent: validatedFields.data.late_fee_percent || 0,
        daily_interest_percent: validatedFields.data.daily_interest_percent || 0,
        iptu_reimbursable: validatedFields.data.iptu_reimbursable || false,
        annual_iptu_amount: validatedFields.data.annual_iptu_amount || null,
      }),
    })

    revalidatePath(`/units/${validatedFields.data.unit_id}`)
    revalidatePath("/properties")
    return { success: "Contrato criado com sucesso!" }
  } catch (error) {
    return {
      error: "Erro ao criar contrato: " + (error instanceof Error ? error.message : "unknown"),
    }
  }
}

export async function endLease(id: string, unitId: string) {
  try {
    await goFetch<Lease>("/api/v1/leases/" + id + "/end", {
      method: "POST",
    })

    revalidatePath(`/units/${unitId}`)
    return { success: true }
  } catch (error) {
    return { error: "Erro ao encerrar contrato: " + (error instanceof Error ? error.message : "unknown") }
  }
}

export async function cancelLease(id: string, unitId: string) {
  try {
    await goFetch<Lease>("/api/v1/leases/" + id, {
      method: "PUT",
      body: JSON.stringify({ status: "CANCELED" }),
    })

    revalidatePath(`/units/${unitId}`)
    return { success: true }
  } catch (error) {
    return { error: "Erro ao cancelar contrato: " + (error instanceof Error ? error.message : "unknown") }
  }
}

export async function getActivePropertiesWithUnits() {
  try {
    const properties = await goFetch<{
      id: string
      name: string
      units: { id: string; label: string }[]
    }[]>("/api/v1/properties", {})
    return properties || []
  } catch {
    return []
  }
}

export async function getActiveTenants() {
  try {
    const tenants = await goFetch<{ id: string; name: string; document?: string }[]>(
      "/api/v1/tenants",
      {}
    )
    return tenants || []
  } catch {
    return []
  }
}