import { z } from "zod"

// Campos numéricos e datas ficam como string no formulário e são convertidos nos toXxxPayload.
// O backend (Go) exige datas em RFC3339, então "2026-01-01" vira "2026-01-01T00:00:00Z".

const DATE = /^\d{4}-\d{2}-\d{2}$/

function parseDecimal(v: string): number {
  const s = v.trim()
  // "1500,50" e "1500.50" valem; "1.500,50" (milhar) não.
  if (!/^\d+([.,]\d+)?$/.test(s)) return NaN
  return Number(s.replace(",", "."))
}

function toRfc3339(date: string): string {
  return `${date}T00:00:00Z`
}

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as Partial<T>
}

const requiredDate = (msg: string) => z.string().regex(DATE, msg)
const optionalDate = z.string().optional().refine((v) => !v || DATE.test(v), "Data inválida")

const positiveMoney = (msg: string) =>
  z.string().refine((v) => Number.isFinite(parseDecimal(v)) && parseDecimal(v) > 0, msg)

const optionalMoney = z
  .string()
  .optional()
  .refine((v) => !v || (Number.isFinite(parseDecimal(v)) && parseDecimal(v) >= 0), "Informe um valor válido")

const dayOfMonth = z
  .string()
  .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 31, "Dia entre 1 e 31")

// ---------- Criar contrato ----------

export const leaseSchema = z
  .object({
    unit_id: z.string().uuid("Selecione uma unidade"),
    tenant_id: z.string().uuid("Selecione um inquilino"),
    start_date: requiredDate("Data de início obrigatória"),
    end_date: optionalDate,
    rent_amount: positiveMoney("Aluguel deve ser maior que zero"),
    deposit_amount: optionalMoney,
    payment_day: dayOfMonth,
    late_fee_percent: optionalMoney.refine((v) => !v || parseDecimal(v) <= 100, "No máximo 100%"),
    daily_interest_percent: optionalMoney.refine((v) => !v || parseDecimal(v) <= 10, "No máximo 10%"),
    iptu_reimbursable: z.boolean().optional(),
    annual_iptu_amount: optionalMoney,
    notes: z.string().max(2000, "No máximo 2000 caracteres").optional(),
    generate_payments: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.end_date && DATE.test(v.start_date) && v.end_date <= v.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "A data final deve ser posterior ao início" })
    }
  })

export type LeaseFormValues = z.infer<typeof leaseSchema>

export function toLeasePayload(v: LeaseFormValues) {
  return compact({
    unit_id: v.unit_id,
    tenant_id: v.tenant_id,
    start_date: toRfc3339(v.start_date),
    end_date: v.end_date ? toRfc3339(v.end_date) : undefined,
    rent_amount: parseDecimal(v.rent_amount),
    deposit_amount: v.deposit_amount ? parseDecimal(v.deposit_amount) : undefined,
    payment_day: Number(v.payment_day),
    late_fee_percent: v.late_fee_percent ? parseDecimal(v.late_fee_percent) : undefined,
    daily_interest_percent: v.daily_interest_percent ? parseDecimal(v.daily_interest_percent) : undefined,
    iptu_reimbursable: v.iptu_reimbursable || undefined,
    annual_iptu_amount: v.iptu_reimbursable && v.annual_iptu_amount ? parseDecimal(v.annual_iptu_amount) : undefined,
    notes: v.notes?.trim() || undefined,
    generate_payments: v.generate_payments || undefined,
  })
}

// ---------- Renovar ----------

export const renewSchema = z.object({
  new_end_date: requiredDate("Informe a nova data final"),
  rent_amount: optionalMoney,
  payment_day: z.string().optional().refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 31), "Dia entre 1 e 31"),
})

export type RenewFormValues = z.infer<typeof renewSchema>

export function toRenewPayload(v: RenewFormValues) {
  return compact({
    new_end_date: toRfc3339(v.new_end_date),
    rent_amount: v.rent_amount ? parseDecimal(v.rent_amount) : undefined,
    payment_day: v.payment_day ? Number(v.payment_day) : undefined,
  })
}

// ---------- Reajustar ----------

export const readjustSchema = z.object({
  // Percentual como o usuário digita (5 = 5%); o backend recebe fração (0.05).
  percentage: z
    .string()
    .refine((v) => Number.isFinite(parseDecimal(v)) && parseDecimal(v) > 0 && parseDecimal(v) <= 100, "Informe um percentual entre 0 e 100"),
  applied_at: requiredDate("Informe a data de aplicação"),
  index_name: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
})

export type ReadjustFormValues = z.infer<typeof readjustSchema>

export function toReadjustPayload(v: ReadjustFormValues) {
  return compact({
    percentage: parseDecimal(v.percentage) / 100,
    applied_at: toRfc3339(v.applied_at),
    index_name: v.index_name?.trim() || undefined,
    notes: v.notes?.trim() || undefined,
  })
}
