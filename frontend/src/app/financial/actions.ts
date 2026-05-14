'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { goFetch } from '@/lib/go/client'
export type {
  DashboardMetrics,
  Receivable,
  Payable,
  Transfer,
  Commission,
  BankRecord,
  TransactionStatus,
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

function mapExpenseStatus(dueDate: string): Payable['status'] {
  const due = new Date(dueDate)
  if (due < new Date()) return 'OVERDUE'
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
    status: mapExpenseStatus(e.due_date),
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

// ─── Leases ──────────────────────────────────────────────────────────────────

interface GoLease {
  id: string
  unit_id: string
  tenant_id: string
  rent_amount: number
  status: string
  is_active: boolean
}

interface GoTenant {
  id: string
  name: string
}

export interface ActiveLease {
  id: string
  label: string
}

export async function getActiveLeases(): Promise<ActiveLease[]> {
  try {
    const [leases, tenants] = await Promise.all([
      goFetch<GoLease[]>('/api/v1/leases') ?? [],
      goFetch<GoTenant[]>('/api/v1/tenants') ?? [],
    ])
    const tenantMap = new Map((tenants ?? []).map((t) => [t.id, t.name]))
    return (leases ?? [])
      .filter((l) => l.status === 'ACTIVE')
      .map((l) => ({
        id: l.id,
        label: `${tenantMap.get(l.tenant_id) ?? l.id.slice(0, 8)} — R$ ${l.rent_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      }))
  } catch (e) {
    console.error('getActiveLeases:', e)
    return []
  }
}

// ─── Create Payment ───────────────────────────────────────────────────────────

const createPaymentSchema = z.object({
  leaseId: z.string().uuid('Contrato inválido'),
  dueDate: z.string().min(1, 'Data de vencimento obrigatória'),
  grossAmount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  type: z.enum(['RENT', 'DEPOSIT', 'EXPENSE', 'OTHER'], {
    error: 'Tipo inválido',
  }),
  competency: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM')
    .optional()
    .or(z.literal('')),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
})

export async function createPayment(
  _prevState: unknown,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const parsed = createPaymentSchema.safeParse({
    leaseId: formData.get('leaseId'),
    dueDate: formData.get('dueDate'),
    grossAmount: formData.get('grossAmount'),
    type: formData.get('type'),
    competency: formData.get('competency') || undefined,
    description: formData.get('description') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const { leaseId, dueDate, grossAmount, type, competency, description } =
    parsed.data

  try {
    await goFetch(`/api/v1/leases/${leaseId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        due_date: `${dueDate}T00:00:00Z`,
        gross_amount: grossAmount,
        type,
        ...(competency ? { competency } : {}),
        ...(description ? { description } : {}),
      }),
    })
    revalidatePath('/financial/receivables')
    return { ok: true }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Erro ao criar cobrança',
    }
  }
}