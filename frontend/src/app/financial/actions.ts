'use server'

import { revalidatePath } from 'next/cache'
import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import {
  payExpenseSchema,
  payReceivableSchema,
  toPayExpensePayload,
  toQuery,
  type FinancialFilters,
  type PayExpenseFormValues,
  type PayReceivableFormValues,
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
  ReceivableRow,
  PayableRow,
  Bucket,
  ReceivablesSummary,
  PayablesSummary,
} from '@/data/financial/dal'

import type {
  ReceivableRow,
  PayableRow,
  ReceivablesSummary,
  PayablesSummary,
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

export type FinancialResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string }

export async function listReceivables(filters: FinancialFilters): Promise<FinancialResult<ReceivableRow[]>> {
  try {
    const payments = (await goFetch<GoPayment[]>('/api/v1/payments' + toQuery(filters, 'lease_id'))) ?? []
    return {
      data: payments.map((p) => ({
        id: p.id,
        leaseId: p.lease_id,
        dueDate: p.due_date,
        paidDate: p.paid_date ?? null,
        competency: p.competency ?? null,
        description: p.description ?? null,
        type: p.type,
        status: p.status,
        amount: p.gross_amount,
        lateFee: p.late_fee_amount ?? 0,
        interest: p.interest_amount ?? 0,
        updatedTotal: p.gross_amount + (p.late_fee_amount ?? 0) + (p.interest_amount ?? 0),
        netAmount: p.net_amount ?? null,
        chargeMethod: p.charge_method ?? null,
      })),
    }
  } catch (e) {
    console.error('Erro ao listar recebíveis:', e)
    return { error: 'Não foi possível carregar as contas a receber.' }
  }
}

export async function getReceivablesSummary(filters: FinancialFilters): Promise<ReceivablesSummary | null> {
  try {
    return await goFetch<ReceivablesSummary>('/api/v1/payments/summary' + toQuery(filters, 'lease_id', { withStatus: false }))
  } catch (e) {
    console.error('Erro ao buscar resumo de recebíveis:', e)
    return null
  }
}

export async function listPayables(filters: FinancialFilters): Promise<FinancialResult<PayableRow[]>> {
  try {
    const expenses = (await goFetch<GoExpense[]>('/api/v1/expenses' + toQuery(filters, 'unit_id'))) ?? []
    return {
      data: expenses.map((e) => ({
        id: e.id,
        unitId: e.unit_id,
        dueDate: e.due_date,
        paidDate: e.paid_date ?? null,
        description: e.description,
        category: e.category,
        status: e.status,
        amount: e.amount,
        paidAmount: e.paid_amount ?? null,
      })),
    }
  } catch (e) {
    console.error('Erro ao listar despesas:', e)
    return { error: 'Não foi possível carregar as contas a pagar.' }
  }
}

export async function getPayablesSummary(filters: FinancialFilters): Promise<PayablesSummary | null> {
  try {
    return await goFetch<PayablesSummary>('/api/v1/expenses/summary' + toQuery(filters, 'unit_id', { withStatus: false }))
  } catch (e) {
    console.error('Erro ao buscar resumo de despesas:', e)
    return null
  }
}

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

export type BatchPayResult = {
  paid: number
  failed: { id: string; error: string }[]
  error?: string
}

/** Baixa várias despesas com a mesma data; devolve as que falharam, sem interromper as demais. */
export async function payExpensesBatch(ids: string[], values: PayExpenseFormValues): Promise<BatchPayResult> {
  const validated = payExpenseSchema.safeParse({ paid_date: values.paid_date })
  if (!validated.success) return { paid: 0, failed: [], error: 'Informe a data do pagamento.' }
  const body = JSON.stringify(toPayExpensePayload(validated.data))

  const failed: BatchPayResult['failed'] = []
  let paid = 0
  for (const id of ids) {
    try {
      await goFetch('/api/v1/expenses/' + id + '/pay', { method: 'POST', body })
      paid++
    } catch (error) {
      failed.push({ id, error: expenseError(error, 'Erro ao dar baixa.').error ?? 'Erro ao dar baixa.' })
    }
  }
  revalidateFinancial()
  return { paid, failed }
}

/** Dá baixa em uma cobrança; o backend recalcula multa, juros e IRRF pela data informada. */
export async function payReceivable(id: string, grossAmount: number, values: PayReceivableFormValues): Promise<FinancialActionResponse> {
  const validated = payReceivableSchema.safeParse(values)
  if (!validated.success) {
    return { error: 'Erro de validação. Verifique os campos.', fieldErrors: validated.error.flatten().fieldErrors }
  }
  try {
    await goFetch('/api/v1/payments/' + id, {
      method: 'PUT',
      body: JSON.stringify({ status: 'PAID', paid_date: toRfc3339(validated.data.paid_date), gross_amount: grossAmount }),
    })
    revalidateFinancial()
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code === 'ALREADY_PAID') return { error: 'Esta cobrança já foi baixada.' }
    console.error('Erro ao dar baixa na cobrança:', error)
    return { error: 'Erro ao dar baixa na cobrança.' }
  }
}
