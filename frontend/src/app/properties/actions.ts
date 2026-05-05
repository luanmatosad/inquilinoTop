"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { propertySchema, unitSchema, PropertyFormValues, UnitFormValues } from "@/lib/schemas"

type ActionResponse<T = void> = {
  success?: boolean
  data?: T
  error?: string
  details?: Record<string, string[]>
}

export interface Property {
  id: string
  owner_id: string
  type: 'RESIDENTIAL' | 'SINGLE'
  name: string
  address_line?: string
  city?: string
  state?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Unit {
  id: string
  property_id: string
  label: string
  floor?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function createProperty(data: PropertyFormValues): Promise<ActionResponse<Property>> {
  const validated = propertySchema.safeParse(data)
  if (!validated.success) {
    return { error: "Dados inválidos", details: validated.error.flatten().fieldErrors }
  }

  try {
    const property = await goFetch<Property>("/api/v1/properties", {
      method: "POST",
      body: JSON.stringify(validated.data),
    })

    if (validated.data.type === "SINGLE") {
      await goFetch<Unit>("/api/v1/properties/" + property.id + "/units", {
        method: "POST",
        body: JSON.stringify({ label: "Unidade 01", notes: "Unidade criada automaticamente" }),
      })
    }

    revalidatePath("/properties")
    return { success: true, data: property }
  } catch (error) {
    console.error("Erro ao criar propriedade:", error)
    return { error: "Erro ao criar propriedade" }
  }
}

export async function updateProperty(id: string, data: PropertyFormValues): Promise<ActionResponse> {
  const validated = propertySchema.safeParse(data)
  if (!validated.success) {
    return { error: "Dados inválidos", details: validated.error.flatten().fieldErrors }
  }

  try {
    await goFetch<Property>("/api/v1/properties/" + id, {
      method: "PUT",
      body: JSON.stringify(validated.data),
    })

    revalidatePath("/properties")
    revalidatePath("/properties/" + id)
    return { success: true }
  } catch (error) {
    console.error("Erro ao atualizar propriedade:", error)
    return { error: "Erro ao atualizar propriedade" }
  }
}

export async function deleteProperty(id: string): Promise<ActionResponse> {
  try {
    await goFetch<{ deleted: boolean }>("/api/v1/properties/" + id, {
      method: "DELETE",
    })

    revalidatePath("/properties")
    return { success: true }
  } catch (error) {
    console.error("Erro ao desativar propriedade:", error)
    return { error: "Erro ao desativar propriedade" }
  }
}

export async function createUnit(propertyId: string, data: UnitFormValues): Promise<ActionResponse> {
  const validated = unitSchema.safeParse(data)
  if (!validated.success) {
    return { error: "Dados inválidos", details: validated.error.flatten().fieldErrors }
  }

  try {
    await goFetch<Unit>("/api/v1/properties/" + propertyId + "/units", {
      method: "POST",
      body: JSON.stringify(validated.data),
    })

    revalidatePath("/properties/" + propertyId)
    return { success: true }
  } catch (error) {
    console.error("Erro ao criar unidade:", error)
    return { error: "Erro ao criar unidade" }
  }
}

export async function updateUnit(id: string, propertyId: string, data: UnitFormValues): Promise<ActionResponse> {
  const validated = unitSchema.safeParse(data)
  if (!validated.success) {
    return { error: "Dados inválidos", details: validated.error.flatten().fieldErrors }
  }

  try {
    await goFetch<Unit>("/api/v1/units/" + id, {
      method: "PUT",
      body: JSON.stringify(validated.data),
    })

    revalidatePath("/properties/" + propertyId)
    return { success: true }
  } catch (error) {
    console.error("Erro ao atualizar unidade:", error)
    return { error: "Erro ao atualizar unidade" }
  }
}

export async function deleteUnit(id: string, propertyId: string): Promise<ActionResponse> {
  try {
    await goFetch<{ deleted: boolean }>("/api/v1/units/" + id, {
      method: "DELETE",
    })

    revalidatePath("/properties/" + propertyId)
    return { success: true }
  } catch (error) {
    console.error("Erro ao desativar unidade:", error)
    return { error: "Erro ao desativar unidade" }
  }
}