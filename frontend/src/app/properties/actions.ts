"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from "next/cache"
import { propertySchema, unitSchema, PropertyFormValues, UnitFormValues } from "@/lib/schemas"

type ActionResponse<T = void> = {
  success?: boolean
  data?: T
  error?: string
  details?: Record<string, string[]>
}

export async function createProperty(data: PropertyFormValues): Promise<ActionResponse<any>> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Usuário não autenticado" }
  }

  const validated = propertySchema.safeParse(data)
  if (!validated.success) {
    return { error: "Dados inválidos", details: validated.error.flatten().fieldErrors }
  }

  const { type, name, address_line, city, state } = validated.data

  try {
    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        owner_id: user.id,
        type,
        name,
        address_line,
        city,
        state,
      })
      .select()
      .single()

    if (error) throw error

    // Lógica específica para SINGLE: criar unidade automaticamente
    if (type === "SINGLE") {
      const { error: unitError } = await supabase
        .from("units")
        .insert({
          property_id: property.id,
          label: "Unidade 01",
          notes: "Unidade criada automaticamente",
        })

      if (unitError) {
        console.error("Erro ao criar unidade automática:", unitError)
      }
    }

    revalidatePath("/properties")
    return { success: true, data: property }
  } catch (error) {
    console.error("Erro ao criar propriedade:", error)
    return { error: "Erro ao criar propriedade" }
  }
}

export async function updateProperty(id: string, data: PropertyFormValues): Promise<ActionResponse> {
  const supabase = await createClient()
  
  const validated = propertySchema.safeParse(data)
  if (!validated.success) {
    return { error: "Dados inválidos", details: validated.error.flatten().fieldErrors }
  }

  try {
    const { error } = await supabase
      .from("properties")
      .update({
        ...validated.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) throw error

    revalidatePath("/properties")
    revalidatePath(`/properties/${id}`)
    return { success: true }
  } catch (error) {
    console.error("Erro ao atualizar propriedade:", error)
    return { error: "Erro ao atualizar propriedade" }
  }
}

export async function deleteProperty(id: string): Promise<ActionResponse> {
  const supabase = await createClient()

  try {
    // Soft delete
    const { error } = await supabase
      .from("properties")
      .update({ is_active: false })
      .eq("id", id)

    if (error) throw error

    revalidatePath("/properties")
    return { success: true }
  } catch (error) {
    console.error("Erro ao desativar propriedade:", error)
    return { error: "Erro ao desativar propriedade" }
  }
}

export async function createUnit(propertyId: string, data: UnitFormValues): Promise<ActionResponse> {
  const supabase = await createClient()

  const validated = unitSchema.safeParse(data)
  if (!validated.success) {
    return { error: "Dados inválidos", details: validated.error.flatten().fieldErrors }
  }

  try {
    const { error } = await supabase
      .from("units")
      .insert({
        property_id: propertyId,
        ...validated.data,
      })

    if (error) throw error

    revalidatePath(`/properties/${propertyId}`)
    return { success: true }
  } catch (error) {
    console.error("Erro ao criar unidade:", error)
    return { error: "Erro ao criar unidade" }
  }
}

export async function updateUnit(id: string, propertyId: string, data: UnitFormValues): Promise<ActionResponse> {
  const supabase = await createClient()

  const validated = unitSchema.safeParse(data)
  if (!validated.success) {
    return { error: "Dados inválidos", details: validated.error.flatten().fieldErrors }
  }

  try {
    const { error } = await supabase
      .from("units")
      .update(validated.data)
      .eq("id", id)

    if (error) throw error

    revalidatePath(`/properties/${propertyId}`)
    return { success: true }
  } catch (error) {
    console.error("Erro ao atualizar unidade:", error)
    return { error: "Erro ao atualizar unidade" }
  }
}

export async function deleteUnit(id: string, propertyId: string): Promise<ActionResponse> {
  const supabase = await createClient()

  try {
    // Soft delete
    const { error } = await supabase
      .from("units")
      .update({ is_active: false })
      .eq("id", id)

    if (error) throw error

    revalidatePath(`/properties/${propertyId}`)
    return { success: true }
  } catch (error) {
    console.error("Erro ao desativar unidade:", error)
    return { error: "Erro ao desativar unidade" }
  }
}
