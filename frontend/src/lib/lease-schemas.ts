import { z } from "zod"
import { compact, parseDecimal, toRfc3339 } from "./form-utils"
import { monthlyToDaily } from "./interest"

// Campos numéricos e datas ficam como string no formulário e são convertidos nos toXxxPayload.
// O backend (Go) exige datas em RFC3339, então "2026-01-01" vira "2026-01-01T00:00:00Z".

const DATE = /^\d{4}-\d{2}-\d{2}$/

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

const leaseBase = z.object({
    unit_id: z.string().uuid("Selecione uma unidade"),
    tenant_id: z.string().uuid("Selecione um inquilino"),
    start_date: requiredDate("Data de início obrigatória"),
    end_date: optionalDate,
    rent_amount: positiveMoney("Aluguel deve ser maior que zero"),
    payment_day: dayOfMonth,
    adjustment_index: z.enum(["", "IGP-M", "IPCA"]).optional(),
    adjustment_month: z
      .string()
      .optional()
      .refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 12), "Mês entre 1 e 12"),
    late_fee_percent: optionalMoney.refine((v) => !v || parseDecimal(v) <= 100, "No máximo 100%"),
    // Juros digitados em % ao mês; o backend guarda % ao dia.
    monthly_interest_percent: optionalMoney.refine((v) => !v || parseDecimal(v) <= 30, "No máximo 30% ao mês"),
    iptu_reimbursable: z.boolean().optional(),
    annual_iptu_amount: optionalMoney,
    notes: z.string().max(2000, "No máximo 2000 caracteres").optional(),
    generate_payments: z.boolean().optional(),
})

export const leaseSchema = leaseBase.superRefine((v, ctx) => {
  if (v.end_date && DATE.test(v.start_date) && v.end_date <= v.start_date) {
    ctx.addIssue({ code: "custom", path: ["end_date"], message: "A data final deve ser posterior ao início" })
  }
})

// Edição: unidade, inquilino e início ficam fixos (o painel os mostra como texto).
export const leaseEditSchema = leaseBase.omit({ unit_id: true, tenant_id: true, start_date: true, generate_payments: true })
export type LeaseEditValues = z.infer<typeof leaseEditSchema>

/** Corpo do PUT. O que a tela não mostra (caução, ano do IPTU, status) o chamador acrescenta via `preserveLeaseFields`. */
export function toLeaseUpdatePayload(v: LeaseEditValues) {
  return compact({
    end_date: v.end_date ? toRfc3339(v.end_date) : undefined,
    rent_amount: parseDecimal(v.rent_amount),
    payment_day: Number(v.payment_day),
    adjustment_index: v.adjustment_index || undefined,
    adjustment_month: v.adjustment_month ? Number(v.adjustment_month) : undefined,
    late_fee_percent: v.late_fee_percent ? parseDecimal(v.late_fee_percent) : undefined,
    daily_interest_percent: v.monthly_interest_percent ? monthlyToDaily(v.monthly_interest_percent) : undefined,
    iptu_reimbursable: v.iptu_reimbursable || undefined,
    annual_iptu_amount: v.iptu_reimbursable && v.annual_iptu_amount ? parseDecimal(v.annual_iptu_amount) : undefined,
    notes: v.notes?.trim() || undefined,
  })
}

export type LeaseFormValues = z.infer<typeof leaseSchema>

export function toLeasePayload(v: LeaseFormValues) {
  return compact({
    unit_id: v.unit_id,
    tenant_id: v.tenant_id,
    start_date: toRfc3339(v.start_date),
    end_date: v.end_date ? toRfc3339(v.end_date) : undefined,
    rent_amount: parseDecimal(v.rent_amount),
    payment_day: Number(v.payment_day),
    adjustment_index: v.adjustment_index || undefined,
    adjustment_month: v.adjustment_month ? Number(v.adjustment_month) : undefined,
    late_fee_percent: v.late_fee_percent ? parseDecimal(v.late_fee_percent) : undefined,
    daily_interest_percent: v.monthly_interest_percent ? monthlyToDaily(v.monthly_interest_percent) : undefined,
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
    .refine((v) => Number.isFinite(parseDecimal(v)) && parseDecimal(v) >= 0.1 && parseDecimal(v) <= 100, "Informe um percentual entre 0,1 e 100"),
  applied_at: requiredDate("Informe a data de aplicação"),
  index_name: z.enum(["", "IGP-M", "IPCA"]).optional(),
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

// ---------- Encerrar ----------

export const END_REASONS = {
  TERM_END: "Fim do prazo",
  TENANT_REQUEST: "Pedido do inquilino",
  NONPAYMENT: "Inadimplência",
  OWNER_REQUEST: "Pedido do proprietário",
  OTHER: "Outro",
} as const

export const endSchema = z.object({
  end_date: requiredDate("Informe a data de saída"),
  reason: z.enum(["TERM_END", "TENANT_REQUEST", "NONPAYMENT", "OWNER_REQUEST", "OTHER"], {
    message: "Selecione o motivo",
  }),
})

export type EndFormValues = z.infer<typeof endSchema>

// O backend aceita a data como YYYY-MM-DD.
export const toEndPayload = (v: EndFormValues) => ({ end_date: v.end_date, reason: v.reason })
