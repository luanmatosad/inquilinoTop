"use server"

import { createProperty } from "@/data/owner/properties-dal"
import { redirect } from "next/navigation"

interface FormState {
  errors?: Record<string, string[]>
}

export async function createPropertyAction(formData: FormData): Promise<FormState> {
  const type = formData.get("type") as string
  const name = formData.get("name") as string
  const address_line = formData.get("address_line") as string
  const city = formData.get("city") as string
  const state = formData.get("state") as string

  const errors: Record<string, string[]> = {}

  if (!type) {
    errors.type = ["Tipo é obrigatório"]
  }
  if (!name || name.trim() === "") {
    errors.name = ["Nome é obrigatório"]
  }

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  try {
    await createProperty({
      type: type as "RESIDENTIAL" | "SINGLE",
      name,
      address_line: address_line || undefined,
      city: city || undefined,
      state: state || undefined,
    })
  } catch (error) {
    console.error("Error creating property:", error)
    return { errors: { _form: ["Erro ao criar imóvel. Tente novamente."] } }
  }

  redirect("/owner/properties")
}