"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { goErrorInfo } from "@/lib/go/errors"
import {
  propertySchema,
  unitSchema,
  toPropertyPayload,
  toUnitPayload,
  PropertyFormValues,
  UnitFormValues,
} from "@/lib/schemas"

type ActionResponse<T = void> = {
  success?: boolean
  data?: T
  error?: string
  details?: Record<string, string[] | undefined>
}

export interface Property {
  id: string
  organization_id: string
  type: 'RESIDENTIAL' | 'SINGLE'
  name: string
  address_line?: string
  neighborhood?: string
  city?: string
  state?: string
  postal_code?: string
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
  area_m2?: number
  bedrooms?: number
  bathrooms?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const DUPLICATE_LABEL = "Já existe uma unidade com essa identificação neste imóvel."

export async function createProperty(data: PropertyFormValues): Promise<ActionResponse<Property>> {
  const validated = propertySchema.safeParse(data)
  if (!validated.success) {
    return { error: "Dados inválidos", details: validated.error.flatten().fieldErrors }
  }

  try {
    // O backend cria "Unidade 01" sozinho quando o tipo é SINGLE.
    const property = await goFetch<Property>("/api/v1/properties", {
      method: "POST",
      body: JSON.stringify(toPropertyPayload(validated.data)),
    })

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
      body: JSON.stringify(toPropertyPayload(validated.data)),
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
      body: JSON.stringify(toUnitPayload(validated.data)),
    })

    revalidatePath("/properties/" + propertyId)
    return { success: true }
  } catch (error) {
    if (goErrorInfo(error).code === "DUPLICATE_UNIT_LABEL") {
      return { error: DUPLICATE_LABEL, details: { label: [DUPLICATE_LABEL] } }
    }
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
      body: JSON.stringify(toUnitPayload(validated.data)),
    })

    revalidatePath("/properties/" + propertyId)
    return { success: true }
  } catch (error) {
    if (goErrorInfo(error).code === "DUPLICATE_UNIT_LABEL") {
      return { error: DUPLICATE_LABEL, details: { label: [DUPLICATE_LABEL] } }
    }
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
