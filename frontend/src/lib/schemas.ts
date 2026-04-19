import { z } from "zod"

export const propertySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["RESIDENTIAL", "SINGLE"], {
    required_error: "Tipo é obrigatório",
  }),
  address_line: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
})

export type PropertyFormValues = z.infer<typeof propertySchema>

export const unitSchema = z.object({
  label: z.string().min(1, "Identificação é obrigatória"),
  floor: z.string().optional(),
  notes: z.string().optional(),
})

export type UnitFormValues = z.infer<typeof unitSchema>
