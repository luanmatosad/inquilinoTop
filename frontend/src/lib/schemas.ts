import { z } from "zod"
import { isValidDocument } from "./br-doc"
import { onlyDigits } from "./masks"

const optionalText = z.string().optional()

const postalCode = z
  .string()
  .optional()
  .refine((v) => !v || onlyDigits(v).length === 8, "CEP deve ter 8 dígitos")

const uf = z
  .string()
  .optional()
  .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), "UF deve ter 2 letras")

/** Remove chaves vazias para o backend tratar como "não informado". */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as Partial<T>
}

// ---------- Imóvel ----------

export const propertySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["RESIDENTIAL", "SINGLE"], {
    message: "Tipo é obrigatório",
  }),
  address_line: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  state: uf,
  postal_code: postalCode,
})

export type PropertyFormValues = z.infer<typeof propertySchema>

export function toPropertyPayload(v: PropertyFormValues) {
  return compact({
    ...v,
    state: v.state?.toUpperCase(),
    postal_code: v.postal_code ? onlyDigits(v.postal_code) : undefined,
  })
}

// ---------- Unidade ----------
// Campos numéricos ficam como string no formulário (input controlado) e são
// convertidos em toUnitPayload.

function parseDecimal(v: string): number {
  return Number(v.trim().replace(",", "."))
}

const positiveDecimal = z
  .string()
  .optional()
  .refine((v) => !v || (Number.isFinite(parseDecimal(v)) && parseDecimal(v) > 0), "Informe um valor maior que zero")

const nonNegativeInt = z
  .string()
  .optional()
  .refine((v) => !v || /^\d+$/.test(v.trim()), "Informe um número inteiro, zero ou mais")

export const unitSchema = z.object({
  label: z.string().min(1, "Identificação é obrigatória"),
  floor: optionalText,
  notes: optionalText,
  area_m2: positiveDecimal,
  bedrooms: nonNegativeInt,
  bathrooms: nonNegativeInt,
})

export type UnitFormValues = z.infer<typeof unitSchema>

export function toUnitPayload(v: UnitFormValues) {
  return compact({
    label: v.label,
    floor: v.floor,
    notes: v.notes,
    area_m2: v.area_m2 ? parseDecimal(v.area_m2) : undefined,
    bedrooms: v.bedrooms ? Number(v.bedrooms) : undefined,
    bathrooms: v.bathrooms ? Number(v.bathrooms) : undefined,
  })
}

// ---------- Inquilino ----------

export const tenantSchema = z
  .object({
    name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
    person_type: z.enum(["PF", "PJ"], { message: "Tipo de pessoa é obrigatório" }),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: optionalText,
    document: optionalText,
    postal_code: postalCode,
    address_line: optionalText,
    city: optionalText,
    state: uf,
    notes: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.document && !isValidDocument(v.person_type, v.document)) {
      ctx.addIssue({
        code: "custom",
        path: ["document"],
        message: v.person_type === "PF" ? "CPF inválido" : "CNPJ inválido",
      })
    }
  })

export type TenantFormValues = z.infer<typeof tenantSchema>

export function toTenantPayload(v: TenantFormValues) {
  return compact({
    ...v,
    state: v.state?.toUpperCase(),
    phone: v.phone ? onlyDigits(v.phone) : undefined,
    document: v.document ? onlyDigits(v.document) : undefined,
    postal_code: v.postal_code ? onlyDigits(v.postal_code) : undefined,
  })
}
