"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { goErrorInfo } from "@/lib/go/errors"
import { tenantSchema, toTenantPayload, TenantFormValues } from "@/lib/schemas"

export type TenantActionResponse = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

interface Tenant {
  id: string
  name: string
  person_type: string
  is_active: boolean
}

/** Traduz erros de regra do backend em mensagem e, quando couber, erro de campo. */
function mapTenantError(error: unknown, fallback: string): TenantActionResponse {
  const { code } = goErrorInfo(error)
  switch (code) {
    case "DUPLICATE_DOCUMENT": {
      const msg = "Já existe um inquilino com esse documento."
      return { error: msg, fieldErrors: { document: [msg] } }
    }
    case "INVALID_DOCUMENT": {
      const msg = "Documento inválido para o tipo de pessoa."
      return { error: msg, fieldErrors: { document: [msg] } }
    }
    case "TENANT_HAS_ACTIVE_LEASE":
      return { error: "Este inquilino tem contrato ativo. Encerre o contrato antes de excluir." }
    default:
      console.error(fallback, error)
      return { error: fallback }
  }
}

export async function createTenant(data: TenantFormValues): Promise<TenantActionResponse> {
  const validated = tenantSchema.safeParse(data)
  if (!validated.success) {
    return { error: "Erro de validação. Verifique os campos.", fieldErrors: validated.error.flatten().fieldErrors }
  }

  try {
    await goFetch<Tenant>("/api/v1/tenants", {
      method: "POST",
      body: JSON.stringify(toTenantPayload(validated.data)),
    })
    revalidatePath("/tenants")
    return { success: true }
  } catch (error) {
    return mapTenantError(error, "Erro ao criar inquilino.")
  }
}

export async function updateTenant(id: string, data: TenantFormValues): Promise<TenantActionResponse> {
  const validated = tenantSchema.safeParse(data)
  if (!validated.success) {
    return { error: "Erro de validação. Verifique os campos.", fieldErrors: validated.error.flatten().fieldErrors }
  }

  try {
    await goFetch<Tenant>("/api/v1/tenants/" + id, {
      method: "PUT",
      body: JSON.stringify(toTenantPayload(validated.data)),
    })
    revalidatePath("/tenants")
    revalidatePath("/tenants/" + id)
    return { success: true }
  } catch (error) {
    return mapTenantError(error, "Erro ao atualizar inquilino.")
  }
}

export async function deleteTenant(id: string): Promise<TenantActionResponse> {
  try {
    await goFetch<{ deleted: boolean }>("/api/v1/tenants/" + id, { method: "DELETE" })
    revalidatePath("/tenants")
    return { success: true }
  } catch (error) {
    return mapTenantError(error, "Erro ao excluir inquilino.")
  }
}
