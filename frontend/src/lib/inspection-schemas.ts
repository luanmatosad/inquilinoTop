import { z } from "zod"
import { compact, toRfc3339 } from "./form-utils"

const DATE = /^\d{4}-\d{2}-\d{2}$/

// Espelham os limites do backend (internal/inspection).
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export const MAX_PHOTOS_PER_ITEM = 10
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export const CONDITIONS = ["GOOD", "FAIR", "POOR", "DAMAGED", "NOT_APPLICABLE"] as const
export type Condition = (typeof CONDITIONS)[number]

export const CONDITION_LABELS: Record<Condition, string> = {
  GOOD: "Bom",
  FAIR: "Regular",
  POOR: "Ruim",
  DAMAGED: "Danificado",
  NOT_APPLICABLE: "Não se aplica",
}

export const INSPECTION_TYPE_LABELS = { ENTRY: "Entrada", EXIT: "Saída" } as const
export const INSPECTION_STATUS_LABELS = { DRAFT: "Rascunho", COMPLETED: "Concluído" } as const

/** Ambientes comuns sugeridos no formulário de item; o campo continua livre. */
export const ROOM_SUGGESTIONS = [
  "Sala",
  "Cozinha",
  "Quarto",
  "Banheiro",
  "Área de serviço",
  "Varanda",
  "Garagem",
  "Quintal",
  "Corredor",
  "Área externa",
] as const

// ---------- Laudo ----------

export const inspectionSchema = z.object({
  lease_id: z.string().uuid("Selecione um contrato"),
  type: z.enum(["ENTRY", "EXIT"], { message: "Selecione o tipo" }),
  inspected_at: z.string().regex(DATE, "Informe a data da vistoria"),
  general_notes: z.string().max(4000, "No máximo 4000 caracteres").optional(),
  copy_from_entry: z.boolean().optional(),
})

export type InspectionFormValues = z.infer<typeof inspectionSchema>

export function toInspectionPayload(v: InspectionFormValues) {
  return compact({
    lease_id: v.lease_id,
    type: v.type,
    inspected_at: toRfc3339(v.inspected_at),
    general_notes: v.general_notes?.trim() || undefined,
    // Só faz sentido na saída: copia os itens da entrada do contrato.
    copy_from_entry: v.type === "EXIT" && v.copy_from_entry ? true : undefined,
  })
}

export const inspectionUpdateSchema = z.object({
  inspected_at: z.string().regex(DATE, "Informe a data da vistoria"),
  general_notes: z.string().max(4000, "No máximo 4000 caracteres").optional(),
})

export type InspectionUpdateValues = z.infer<typeof inspectionUpdateSchema>

export function toInspectionUpdatePayload(v: InspectionUpdateValues) {
  return {
    inspected_at: toRfc3339(v.inspected_at),
    general_notes: v.general_notes?.trim() || undefined,
  }
}

// ---------- Item ----------

export const itemSchema = z.object({
  room: z.string().trim().min(1, "Informe o ambiente").max(100, "No máximo 100 caracteres"),
  item: z.string().trim().min(1, "Informe o item").max(150, "No máximo 150 caracteres"),
  condition: z.enum(CONDITIONS, { message: "Selecione a condição" }),
  notes: z.string().max(2000, "No máximo 2000 caracteres").optional(),
})

export type ItemFormValues = z.infer<typeof itemSchema>

export function toItemPayload(v: ItemFormValues) {
  return compact({
    room: v.room.trim(),
    item: v.item.trim(),
    condition: v.condition,
    notes: v.notes?.trim() || undefined,
  })
}

// ---------- Fotos ----------

/** Valida o arquivo no navegador antes de enviar; o backend confere de novo pelo conteúdo. */
export function validatePhotoFile(file: Pick<File, "type" | "size">): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return "A foto deve ser JPEG, PNG ou WebP."
  }
  if (file.size === 0) return "O arquivo está vazio."
  if (file.size > MAX_PHOTO_BYTES) return "A foto excede 10 MB."
  return null
}
