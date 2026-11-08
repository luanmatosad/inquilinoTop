'use server'

import { revalidatePath } from 'next/cache'
import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import {
  expenseFormSchema,
  payExpenseSchema,
  registerPaymentSchemaFor,
  toPaymentPayload,
  agreementSchemaFor,
  toAgreementPayload,
  toExpensePayload,
  toPayExpensePayload,
  type ExpenseFormValues,
  type PayExpenseFormValues,
  type RegisterPaymentValues,
  type AgreementFormValues,
} from '@/lib/financial-schemas'
import { toRfc3339 } from '@/lib/form-utils'
export type {
  DashboardMetrics,
  Receivable,
  Payable,
  Transfer,
  Commission,
  BankRecord,
  TransactionStatus,
  LedgerStatus,
} from '@/data/financial/dal'

import type {
  DashboardMetrics,
  Receivable,
  Payable,
  Transfer,
  Commission,
  BankRecord,
} from '@/data/financial/dal'

interface GoPayment {
  id: string
  lease_id: string
  due_date: string
  paid_date?: string
  gross_amount: number
  late_fee_amount?: number
  interest_amount?: number
  net_amount?: number
  status: 'PENDING' | 'PAID' | 'LATE'
  type: 'RENT' | 'DEPOSIT' | 'EXPENSE' | 'OTHER'
  charge_method?: string
  description?: string
  competency?: string
}

interface GoExpense {
  id: string
  unit_id: string
  description: string
  amount: number
  due_date: string
  category: 'ELECTRICITY' | 'WATER' | 'CONDO' | 'TAX' | 'MAINTENANCE' | 'OTHER'
  status: 'PENDING' | 'PAID' | 'LATE'
  paid_date?: string
  paid_amount?: number
}

function mapPaymentStatus(status: string): Receivable['status'] {
  if (status === 'PAID') return 'PAID'
  if (status === 'LATE') return 'OVERDUE'
  return 'PENDING'
}

function mapPaymentType(type: string): Receivable['type'] {
  if (type === 'RENT') return 'RENT'
  return 'CONDO_FEE'
}

function mapChargeMethod(method?: string): Receivable['paymentMethod'] {
  if (method === 'PIX') return 'PIX'
  if (method === 'BOLETO') return 'BOLETO'
  return 'PIX'
}

function mapExpenseCategory(category: string): Payable['category'] {
  if (category === 'TAX') return 'PROPERTY_TAX'
  if (category === 'CONDO') return 'CONDO_FEE'
  if (category === 'MAINTENANCE') return 'MAINTENANCE'
  return 'OTHER'
}

function mapExpenseStatus(status: GoExpense['status']): Payable['status'] {
  if (status === 'PAID') return 'PAID'
  if (status === 'LATE') return 'OVERDUE'
  return 'PENDING'
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  let payments: GoPayment[] = []
  try {
    payments = await goFetch<GoPayment[]>('/api/v1/payments') || []
  } catch (e) {
    console.error(e)
  }

  const realizedRevenue = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  const expectedRevenue = payments
    .filter(p => p.status === 'PAID' || p.status === 'PENDING')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  const late = payments.filter(p => p.status === 'LATE').length
  const defaultRate = payments.length > 0 ? (late / payments.length) * 100 : 0

  const totalRentValue = payments
    .filter(p => p.type === 'RENT')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  const totalToTransfer = payments
    .filter(p => p.status === 'PAID' && p.type === 'RENT')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  return {
    expectedRevenue,
    realizedRevenue,
    defaultRate: parseFloat(defaultRate.toFixed(1)),
    totalRentValue,
    totalToTransfer,
  }
}

export async function getReceivables(): Promise<Receivable[]> {
  let payments: GoPayment[] = []
  try {
    payments = await goFetch<GoPayment[]>('/api/v1/payments') || []
  } catch (e) {
    console.error(e)
  }

  return payments
    .filter(p => p.type === 'RENT' || p.type === 'OTHER')
    .map(p => ({
      id: p.id,
      dueDate: p.due_date,
      payer: p.description ?? `Lease ${p.lease_id.slice(0, 8)}`,
      property: p.competency ?? '—',
      amount: p.gross_amount,
      paymentMethod: mapChargeMethod(p.charge_method),
      status: mapPaymentStatus(p.status),
      type: mapPaymentType(p.type),
    }))
}

export async function getPayables(): Promise<Payable[]> {
  let expenses: GoExpense[] = []
  try {
    expenses = await goFetch<GoExpense[]>('/api/v1/expenses') || []
  } catch (e) {
    console.error(e)
  }

  return expenses.map(e => ({
    id: e.id,
    dueDate: e.due_date,
    supplier: e.description,
    category: mapExpenseCategory(e.category),
    amount: e.amount,
    relatedProperty: e.unit_id,
    status: mapExpenseStatus(e.status),
  }))
}

export async function getTransfers(): Promise<Transfer[]> {
  return []
}

export async function getCommissions(): Promise<Commission[]> {
  return []
}

export async function getBankRecords(): Promise<BankRecord[]> {
  return []
}

// ---------------------------------------------------------------------------
// Contas a receber e a pagar (telas /financial/receivables e /financial/payables)
// ---------------------------------------------------------------------------

export type FinancialActionResponse = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

const EXPENSE_ERRORS: Record<string, string> = {
  EXPENSE_ALREADY_PAID: 'Esta despesa já está paga.',
  EXPENSE_NOT_PAID: 'Esta despesa não está paga.',
  EXPENSE_LOCKED: 'Despesa paga não aceita alterar valor ou vencimento.',
  NOT_FOUND: 'Despesa não encontrada.',
}

function expenseError(error: unknown, fallback: string): FinancialActionResponse {
  const { code } = goErrorInfo(error)
  const message = (code && EXPENSE_ERRORS[code]) || fallback
  if (!code || !EXPENSE_ERRORS[code]) console.error(fallback, error)
  return { error: message }
}

function revalidateFinancial() {
  revalidatePath('/financial/payables')
  revalidatePath('/financial/receivables')
  revalidatePath('/financial/dashboard')
}

/** Registra o envio (SENT) ou o lembrete (REMINDER) da cobrança na linha do tempo. */
export async function recordPaymentEvent(
  id: string,
  kind: 'SENT' | 'REMINDER',
  channel: 'WHATSAPP' | 'EMAIL' | 'COPY',
): Promise<FinancialActionResponse> {
  try {
    await goFetch(`/api/v1/payments/${id}/events`, { method: 'POST', body: JSON.stringify({ kind, channel }) })
    revalidatePath(`/financial/receivables/${id}`)
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code === 'ALREADY_PAID') return { error: 'Esta cobrança já está paga.' }
    console.error('Erro ao registrar envio da cobrança:', error)
    return { error: 'Erro ao registrar o envio.' }
  }
}

/** Lança uma despesa por unidade; com `paid` e `paid_date`, ela nasce paga (uma só chamada ao backend). */
export async function createPayable(values: ExpenseFormValues): Promise<FinancialActionResponse> {
  const validated = expenseFormSchema.safeParse(values)
  if (!validated.success) {
    return { error: 'Erro de validação. Verifique os campos.', fieldErrors: validated.error.flatten().fieldErrors }
  }
  try {
    await goFetch(`/api/v1/units/${validated.data.unit_id}/expenses`, {
      method: 'POST',
      body: JSON.stringify(toExpensePayload(validated.data)),
    })
    revalidateFinancial()
    revalidatePath(`/units/${validated.data.unit_id}`)
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code === 'INVALID_PAID_DATE') {
      const message = 'A data do pagamento não pode ser futura.'
      return { error: message, fieldErrors: { paid_date: [message] } }
    }
    console.error('Erro ao lançar despesa:', error)
    return { error: 'Erro ao lançar a despesa.' }
  }
}

export async function payExpense(id: string, values: PayExpenseFormValues): Promise<FinancialActionResponse> {
  const validated = payExpenseSchema.safeParse(values)
  if (!validated.success) {
    return { error: 'Erro de validação. Verifique os campos.', fieldErrors: validated.error.flatten().fieldErrors }
  }
  try {
    await goFetch('/api/v1/expenses/' + id + '/pay', { method: 'POST', body: JSON.stringify(toPayExpensePayload(validated.data)) })
    revalidateFinancial()
    return { success: true }
  } catch (error) {
    return expenseError(error, 'Erro ao dar baixa na despesa.')
  }
}

export async function unpayExpense(id: string): Promise<FinancialActionResponse> {
  try {
    await goFetch('/api/v1/expenses/' + id + '/unpay', { method: 'POST' })
    revalidateFinancial()
    return { success: true }
  } catch (error) {
    return expenseError(error, 'Erro ao estornar a baixa.')
  }
}

/** Registra o pagamento de uma cobrança; o backend recalcula multa, juros, desconto e IRRF pela data informada. */
export async function payReceivable(id: string, grossAmount: number, values: RegisterPaymentValues): Promise<FinancialActionResponse> {
  // O limite do desconto (valor devido hoje) é conferido pelo backend; aqui só o formato.
  const validated = registerPaymentSchemaFor(Number.MAX_SAFE_INTEGER).safeParse(values)
  if (!validated.success) {
    return { error: 'Erro de validação. Verifique os campos.', fieldErrors: validated.error.flatten().fieldErrors }
  }
  try {
    await goFetch('/api/v1/payments/' + id, {
      method: 'PUT',
      body: JSON.stringify(toPaymentPayload(validated.data, grossAmount)),
    })
    revalidateFinancial()
    revalidatePath(`/financial/receivables/${id}`)
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code === 'ALREADY_PAID') return { error: 'Esta cobrança já foi baixada.' }
    if (code === 'INVALID_DISCOUNT') {
      const message = 'O desconto não pode passar do valor devido.'
      return { error: message, fieldErrors: { discount_amount: [message] } }
    }
    console.error('Erro ao dar baixa na cobrança:', error)
    return { error: 'Erro ao dar baixa na cobrança.' }
  }
}

/** Acordo de atraso: novo vencimento e valor combinado. */
export async function createAgreement(id: string, values: AgreementFormValues, today: string): Promise<FinancialActionResponse> {
  const validated = agreementSchemaFor(today).safeParse(values)
  if (!validated.success) {
    return { error: 'Erro de validação. Verifique os campos.', fieldErrors: validated.error.flatten().fieldErrors }
  }
  try {
    await goFetch(`/api/v1/payments/${id}/agreement`, { method: 'POST', body: JSON.stringify(toAgreementPayload(validated.data)) })
    revalidateFinancial()
    revalidatePath(`/financial/receivables/${id}`)
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    const rule: Record<string, { message: string; field?: string }> = {
      INVALID_AGREEMENT_DATE: { message: 'O novo vencimento deve ser depois de hoje.', field: 'new_due_date' },
      INVALID_AGREEMENT: { message: 'Valor combinado inválido.', field: 'agreed_amount' },
      ALREADY_PAID: { message: 'Esta cobrança já está paga.' },
      PAYMENT_HAS_CHARGE: { message: 'Esta cobrança já foi emitida pelo provedor e não aceita acordo.' },
    }
    const r = code ? rule[code] : undefined
    if (r) return { error: r.message, fieldErrors: r.field ? { [r.field]: [r.message] } : undefined }
    console.error('Erro ao salvar acordo:', error)
    return { error: 'Erro ao salvar o acordo.' }
  }
}

/** Gera (ou troca) o link público da cobrança; o anterior deixa de valer e a URL só aparece nesta resposta. */
export async function createPaymentLink(id: string): Promise<{ url: string } | { error: string }> {
  try {
    const res = await goFetch<{ url: string }>(`/api/v1/payments/${id}/link`, { method: 'POST' })
    return { url: res.url }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code === 'PUBLIC_URL_NOT_CONFIGURED') return { error: 'Configure APP_PUBLIC_URL no servidor para gerar o link.' }
    if (code === 'NOT_FOUND') return { error: 'Cobrança não encontrada.' }
    console.error('Erro ao gerar o link da cobrança:', error)
    return { error: 'Erro ao gerar o link.' }
  }
}

const REPORT_ERRORS: Record<string, string> = {
  NO_PENDING_REPORT: 'Esta cobrança não tem aviso pendente.',
  ALREADY_PAID: 'Esta cobrança já está paga.',
  NOT_FOUND: 'Cobrança não encontrada.',
}

async function reportAction(id: string, path: 'confirm-report' | 'reject-report', fallback: string): Promise<FinancialActionResponse> {
  try {
    await goFetch(`/api/v1/payments/${id}/${path}`, { method: 'POST', body: path === 'confirm-report' ? '{}' : undefined })
    revalidateFinancial()
    revalidatePath(`/financial/receivables/${id}`)
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code && REPORT_ERRORS[code]) return { error: REPORT_ERRORS[code] }
    console.error(fallback, error)
    return { error: fallback }
  }
}

/** Confirma o aviso do inquilino: baixa a cobrança como Pix na data que ele informou. */
export async function confirmReport(id: string): Promise<FinancialActionResponse> {
  return reportAction(id, 'confirm-report', 'Erro ao confirmar o recebimento.')
}

/** "Ainda não recebi": descarta o aviso e a cobrança volta ao estado de antes. */
export async function rejectReport(id: string): Promise<FinancialActionResponse> {
  return reportAction(id, 'reject-report', 'Erro ao recusar o aviso.')
}
