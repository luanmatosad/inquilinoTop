import { z } from "zod"
import { compact, parseDecimal, toRfc3339 } from "./form-utils"

const DATE = /^\d{4}-\d{2}-\d{2}$/

// ---------- Baixa de despesa ----------

export const payExpenseSchema = z.object({
  paid_date: z.string().regex(DATE, "Informe a data do pagamento"),
  // Vazio = paga o valor da despesa.
  paid_amount: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isFinite(parseDecimal(v)) && parseDecimal(v) > 0), "Informe um valor maior que zero"),
})

export type PayExpenseFormValues = z.infer<typeof payExpenseSchema>

export function toPayExpensePayload(v: PayExpenseFormValues) {
  return compact({
    paid_date: toRfc3339(v.paid_date),
    paid_amount: v.paid_amount ? parseDecimal(v.paid_amount) : undefined,
  })
}

// ---------- Lançar despesa ----------

export const EXPENSE_CATEGORIES = ["ELECTRICITY", "WATER", "CONDO", "TAX", "MAINTENANCE", "OTHER"] as const

export const expenseFormSchema = z
  .object({
    description: z.string().trim().min(3, "Descreva a despesa (mínimo 3 letras)").max(500, "No máximo 500 caracteres"),
    unit_id: z.string().uuid("Escolha a unidade"),
    category: z.enum(EXPENSE_CATEGORIES, { message: "Escolha a categoria" }),
    amount: z.string().refine((v) => Number.isFinite(parseDecimal(v)) && parseDecimal(v) > 0, "Informe um valor maior que zero"),
    due_date: z.string().regex(DATE, "Informe o vencimento"),
    paid: z.boolean().optional(),
    paid_date: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.paid && !(v.paid_date && DATE.test(v.paid_date))) {
      ctx.addIssue({ code: "custom", path: ["paid_date"], message: "Informe a data do pagamento" })
    }
  })

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

/** Corpo do `POST /units/{unitId}/expenses`; `unit_id` vai no caminho. */
export function toExpensePayload(v: ExpenseFormValues) {
  return compact({
    description: v.description.trim(),
    amount: parseDecimal(v.amount),
    due_date: toRfc3339(v.due_date),
    category: v.category,
    paid_date: v.paid && v.paid_date ? toRfc3339(v.paid_date) : undefined,
  })
}

// ---------- Baixa de recebível ----------

export const payReceivableSchema = z.object({
  paid_date: z.string().regex(DATE, "Informe a data do recebimento"),
})

export type PayReceivableFormValues = z.infer<typeof payReceivableSchema>

// ---------- Filtros das telas ----------

export const EXPENSE_STATUSES = ["PENDING", "LATE", "PAID"] as const
export type FinancialStatus = (typeof EXPENSE_STATUSES)[number]

export interface FinancialFilters {
  status?: FinancialStatus
  from?: string
  to?: string
  /** unit_id nas despesas; lease_id nos recebíveis. */
  ref?: string
}

/** Lê e sanitiza os filtros da query string; valores inválidos viram "sem filtro". */
export function parseFilters(params: { status?: string; from?: string; to?: string; ref?: string }): FinancialFilters {
  const f: FinancialFilters = {}
  if (params.status && (EXPENSE_STATUSES as readonly string[]).includes(params.status)) {
    f.status = params.status as FinancialStatus
  }
  if (params.from && DATE.test(params.from)) f.from = params.from
  if (params.to && DATE.test(params.to)) f.to = params.to
  if (params.ref && /^[0-9a-fA-F-]{36}$/.test(params.ref)) f.ref = params.ref
  return f
}

/** Monta a query string do backend; `refParam` é unit_id (despesas) ou lease_id (recebíveis). */
export function toQuery(f: FinancialFilters, refParam: "unit_id" | "lease_id", opts: { withStatus?: boolean } = { withStatus: true }): string {
  const q = new URLSearchParams()
  if (opts.withStatus !== false && f.status) q.set("status", f.status)
  if (f.from) q.set("from", f.from)
  if (f.to) q.set("to", f.to)
  if (f.ref) q.set(refParam, f.ref)
  const s = q.toString()
  return s ? `?${s}` : ""
}
