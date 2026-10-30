"use server"

import { revalidatePath } from "next/cache"
import { goFetch } from "@/lib/go/client"
import { goErrorInfo } from "@/lib/go/errors"
import {
  inspectionSchema,
  inspectionUpdateSchema,
  itemSchema,
  toInspectionPayload,
  toInspectionUpdatePayload,
  toItemPayload,
  type InspectionFormValues,
  type InspectionUpdateValues,
  type ItemFormValues,
} from "@/lib/inspection-schemas"

export type InspectionActionResponse<T = unknown> = {
  success?: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

const RULE_ERRORS: Record<string, { message: string; field?: string }> = {
  INSPECTION_DUPLICATE: { message: "Este contrato já tem um laudo ativo desse tipo.", field: "type" },
  LEASE_NOT_FOUND: { message: "Contrato não encontrado.", field: "lease_id" },
  INSPECTION_NOT_EDITABLE: { message: "O laudo já foi concluído e não pode mais ser alterado." },
  INSPECTION_WITHOUT_ITEMS: { message: "Adicione ao menos um item antes de concluir o laudo." },
  COMPARISON_UNAVAILABLE: { message: "A comparação exige laudos de entrada e de saída concluídos." },
  NOT_FOUND: { message: "Laudo ou item não encontrado." },
}

function mapError<T = unknown>(error: unknown, fallback: string): InspectionActionResponse<T> {
  const { code } = goErrorInfo(error)
  const rule = code ? RULE_ERRORS[code] : undefined
  if (rule) return { error: rule.message, fieldErrors: rule.field ? { [rule.field]: [rule.message] } : undefined }
  console.error(fallback, error)
  return { error: fallback }
}

interface Inspection {
  id: string
  type: "ENTRY" | "EXIT"
  status: "DRAFT" | "COMPLETED"
}

export async function createInspection(values: InspectionFormValues): Promise<InspectionActionResponse<Inspection>> {
  const validated = inspectionSchema.safeParse(values)
  if (!validated.success) {
    return { error: "Erro de validação. Verifique os campos.", fieldErrors: validated.error.flatten().fieldErrors }
  }
  try {
    const created = await goFetch<Inspection>("/api/v1/inspections", {
      method: "POST",
      body: JSON.stringify(toInspectionPayload(validated.data)),
    })
    revalidatePath("/inspections")
    return { success: true, data: created }
  } catch (error) {
    return mapError(error, "Erro ao criar o laudo.")
  }
}

export async function updateInspection(id: string, values: InspectionUpdateValues): Promise<InspectionActionResponse> {
  const validated = inspectionUpdateSchema.safeParse(values)
  if (!validated.success) {
    return { error: "Erro de validação. Verifique os campos.", fieldErrors: validated.error.flatten().fieldErrors }
  }
  try {
    await goFetch("/api/v1/inspections/" + id, { method: "PUT", body: JSON.stringify(toInspectionUpdatePayload(validated.data)) })
    revalidatePath("/inspections/" + id)
    return { success: true }
  } catch (error) {
    return mapError(error, "Erro ao salvar o laudo.")
  }
}

export async function deleteInspection(id: string): Promise<InspectionActionResponse> {
  try {
    await goFetch("/api/v1/inspections/" + id, { method: "DELETE" })
    revalidatePath("/inspections")
    return { success: true }
  } catch (error) {
    return mapError(error, "Erro ao excluir o laudo.")
  }
}

export async function completeInspection(id: string): Promise<InspectionActionResponse> {
  try {
    await goFetch("/api/v1/inspections/" + id + "/complete", { method: "POST" })
    revalidatePath("/inspections")
    revalidatePath("/inspections/" + id)
    return { success: true }
  } catch (error) {
    return mapError(error, "Erro ao concluir o laudo.")
  }
}

export async function addItem(inspectionId: string, values: ItemFormValues): Promise<InspectionActionResponse> {
  const validated = itemSchema.safeParse(values)
  if (!validated.success) {
    return { error: "Erro de validação. Verifique os campos.", fieldErrors: validated.error.flatten().fieldErrors }
  }
  try {
    await goFetch(`/api/v1/inspections/${inspectionId}/items`, { method: "POST", body: JSON.stringify(toItemPayload(validated.data)) })
    revalidatePath("/inspections/" + inspectionId)
    return { success: true }
  } catch (error) {
    return mapError(error, "Erro ao adicionar o item.")
  }
}

export async function updateItem(inspectionId: string, itemId: string, values: ItemFormValues): Promise<InspectionActionResponse> {
  const validated = itemSchema.safeParse(values)
  if (!validated.success) {
    return { error: "Erro de validação. Verifique os campos.", fieldErrors: validated.error.flatten().fieldErrors }
  }
  try {
    await goFetch(`/api/v1/inspections/${inspectionId}/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(toItemPayload(validated.data)),
    })
    revalidatePath("/inspections/" + inspectionId)
    return { success: true }
  } catch (error) {
    return mapError(error, "Erro ao salvar o item.")
  }
}

export async function deleteItem(inspectionId: string, itemId: string): Promise<InspectionActionResponse> {
  try {
    await goFetch(`/api/v1/inspections/${inspectionId}/items/${itemId}`, { method: "DELETE" })
    revalidatePath("/inspections/" + inspectionId)
    return { success: true }
  } catch (error) {
    return mapError(error, "Erro ao remover o item.")
  }
}

export async function deletePhoto(inspectionId: string, itemId: string, photoId: string): Promise<InspectionActionResponse> {
  try {
    await goFetch(`/api/v1/inspections/${inspectionId}/items/${itemId}/photos/${photoId}`, { method: "DELETE" })
    revalidatePath("/inspections/" + inspectionId)
    return { success: true }
  } catch (error) {
    return mapError(error, "Erro ao remover a foto.")
  }
}
