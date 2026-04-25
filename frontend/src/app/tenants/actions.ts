"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { z } from "zod"

const tenantSchema = z.object({
  name: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  email: z.string().email({ message: "Email inválido." }).optional().or(z.literal("")),
  phone: z.string().optional(),
  document: z.string().optional(),
  person_type: z.enum(["PF", "PJ"]),
})

export type TenantActionState = {
  error?: string
  success?: string
  fieldErrors?: {
    [key: string]: string[]
  }
} | null

interface Tenant {
  id: string
  name: string
  email?: string
  phone?: string
  document?: string
  person_type: string
  is_active: boolean
  created_at: string
}

export async function createTenant(prevState: TenantActionState, formData: FormData) {
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    document: formData.get("document"),
    person_type: formData.get("person_type") || "PF",
  }

  const validatedFields = tenantSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: "Erro de validação. Verifique os campos.",
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    }
  }

  try {
    const tenant = await goFetch<Tenant>("/api/v1/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: validatedFields.data.name,
        email: validatedFields.data.email || null,
        phone: validatedFields.data.phone || null,
        document: validatedFields.data.document || null,
        person_type: validatedFields.data.person_type,
      }),
    })

    revalidatePath("/tenants")
    return { success: "Inquilino criado com sucesso!" }
  } catch (error) {
    return {
      error: "Erro ao criar inquilino: " + (error instanceof Error ? error.message : "unknown"),
    }
  }
}

export async function updateTenant(id: string, prevState: TenantActionState, formData: FormData) {
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    document: formData.get("document"),
    person_type: formData.get("person_type") || "PF",
  }

  const validatedFields = tenantSchema.safeParse(rawData)

  if (!validatedFields.success) {
    return {
      error: "Erro de validação. Verifique os campos.",
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    }
  }

  try {
    await goFetch<Tenant>("/api/v1/tenants/" + id, {
      method: "PUT",
      body: JSON.stringify({
        name: validatedFields.data.name,
        email: validatedFields.data.email || null,
        phone: validatedFields.data.phone || null,
        document: validatedFields.data.document || null,
        person_type: validatedFields.data.person_type,
      }),
    })

    revalidatePath("/tenants")
    return { success: "Inquilino atualizado com sucesso!" }
  } catch (error) {
    return {
      error: "Erro ao atualizar inquilino: " + (error instanceof Error ? error.message : "unknown"),
    }
  }
}

export async function deleteTenant(id: string) {
  try {
    await goFetch<{ deleted: boolean }>("/api/v1/tenants/" + id, {
      method: "DELETE",
    })

    revalidatePath("/tenants")
    return { success: true }
  } catch (error) {
    return { error: "Erro ao excluir inquilino: " + (error instanceof Error ? error.message : "unknown") }
  }
}

export async function toggleTenantStatus(id: string, isActive: boolean) {
  try {
    const tenant = await goFetch<Tenant>("/api/v1/tenants/" + id, {
      method: "PUT",
      body: JSON.stringify({ is_active: isActive }),
    })

    revalidatePath("/tenants")
    return { success: true }
  } catch (error) {
    return { error: "Erro ao atualizar status: " + (error instanceof Error ? error.message : "unknown") }
  }
}