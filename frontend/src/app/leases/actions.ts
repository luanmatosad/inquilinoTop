"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { goErrorInfo } from "@/lib/go/errors"
import {
  leaseSchema,
  renewSchema,
  readjustSchema,
  toLeasePayload,
  toRenewPayload,
  toReadjustPayload,
  type LeaseFormValues,
  type RenewFormValues,
  type ReadjustFormValues,
} from "@/lib/lease-schemas"

export type LeaseActionResponse<T = unknown> = {
  success?: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

interface Lease {
  id: string
  unit_id: string
  tenant_id: string
  status: string
}

export interface CreatedLease extends Lease {
  payments_generated?: number
  payments_error?: string
}

export interface EndedLease extends Lease {
  payments_canceled?: number
  payments_need_review?: number
  payments_error?: string
}

/** Mensagens e, quando couber, o campo do formulário para cada erro de regra do backend. */
const RULE_ERRORS: Record<string, { message: string; field?: string }> = {
  LEASE_OVERLAP: { message: "Esta unidade já tem contrato ativo no período informado.", field: "unit_id" },
  INVALID_DATES: { message: "A data final deve ser posterior à data inicial.", field: "end_date" },
  UNIT_NOT_FOUND: { message: "Unidade não encontrada.", field: "unit_id" },
  TENANT_NOT_FOUND: { message: "Inquilino não encontrado.", field: "tenant_id" },
  LEASE_NOT_ACTIVE: { message: "Este contrato não está ativo." },
  STATUS_CHANGE_NOT_ALLOWED: { message: "O status só muda por encerrar ou renovar." },
  NOT_FOUND: { message: "Contrato não encontrado." },
}

function mapLeaseError<T = unknown>(error: unknown, fallback: string): LeaseActionResponse<T> {
  const { code } = goErrorInfo(error)
  const rule = code ? RULE_ERRORS[code] : undefined
  if (rule) {
    return { error: rule.message, fieldErrors: rule.field ? { [rule.field]: [rule.message] } : undefined }
  }
  console.error(fallback, error)
  return { error: fallback }
}

export async function createLease(values: LeaseFormValues): Promise<LeaseActionResponse<CreatedLease>> {
  const validated = leaseSchema.safeParse(values)
  if (!validated.success) {
    return { error: "Erro de validação. Verifique os campos.", fieldErrors: validated.error.flatten().fieldErrors }
  }

  try {
    const lease = await goFetch<CreatedLease>("/api/v1/leases", {
      method: "POST",
      body: JSON.stringify(toLeasePayload(validated.data)),
    })
    revalidatePath("/leases")
    revalidatePath(`/units/${validated.data.unit_id}`)
    revalidatePath("/properties")
    return { success: true, data: lease }
  } catch (error) {
    return mapLeaseError(error, "Erro ao criar contrato.")
  }
}

export async function endLease(id: string, unitId?: string): Promise<LeaseActionResponse<EndedLease>> {
  try {
    const lease = await goFetch<EndedLease>("/api/v1/leases/" + id + "/end", { method: "POST" })
    revalidatePath("/leases")
    revalidatePath("/leases/" + id)
    if (unitId) revalidatePath(`/units/${unitId}`)
    return { success: true, data: lease }
  } catch (error) {
    return mapLeaseError(error, "Erro ao encerrar contrato.")
  }
}

export async function renewLease(id: string, values: RenewFormValues): Promise<LeaseActionResponse> {
  const validated = renewSchema.safeParse(values)
  if (!validated.success) {
    return { error: "Erro de validação. Verifique os campos.", fieldErrors: validated.error.flatten().fieldErrors }
  }

  try {
    await goFetch<Lease>("/api/v1/leases/" + id + "/renew", {
      method: "POST",
      body: JSON.stringify(toRenewPayload(validated.data)),
    })
    revalidatePath("/leases")
    revalidatePath("/leases/" + id)
    return { success: true }
  } catch (error) {
    const mapped = mapLeaseError(error, "Erro ao renovar contrato.")
    // Na renovação o campo afetado é a nova data final, não end_date.
    if (mapped.fieldErrors?.end_date) mapped.fieldErrors = { new_end_date: mapped.fieldErrors.end_date }
    if (mapped.fieldErrors?.unit_id) mapped.fieldErrors = { new_end_date: mapped.fieldErrors.unit_id }
    return mapped
  }
}

export async function readjustLease(id: string, values: ReadjustFormValues): Promise<LeaseActionResponse> {
  const validated = readjustSchema.safeParse(values)
  if (!validated.success) {
    return { error: "Erro de validação. Verifique os campos.", fieldErrors: validated.error.flatten().fieldErrors }
  }

  try {
    await goFetch("/api/v1/leases/" + id + "/readjust", {
      method: "POST",
      body: JSON.stringify(toReadjustPayload(validated.data)),
    })
    revalidatePath("/leases")
    revalidatePath("/leases/" + id)
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code === "INVALID_PERCENTAGE") {
      const message = "Percentual inválido."
      return { error: message, fieldErrors: { percentage: [message] } }
    }
    return mapLeaseError(error, "Erro ao reajustar contrato.")
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
