'use server'

import { goFetch } from '@/lib/go/client'
export type {
  DashboardMetrics,
  Recebimento,
  Pagamento,
  Repasse,
  Comissao,
  BankRecord,
  TransactionStatus,
} from '@/data/financeiro/dal'

import type {
  DashboardMetrics,
  Recebimento,
  Pagamento,
  Repasse,
  Comissao,
  BankRecord,
} from '@/data/financeiro/dal'

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

function mapPaymentStatus(status: string): Recebimento['status'] {
  if (status === 'PAID') return 'Pago'
  if (status === 'LATE') return 'Atrasado'
  return 'Pendente'
}

function mapPaymentType(type: string): Recebimento['tipo'] {
  if (type === 'RENT') return 'Aluguel'
  return 'Taxa Condominial'
}

function mapChargeMethod(method?: string): Recebimento['formaPagto'] {
  if (method === 'PIX') return 'PIX'
  if (method === 'BOLETO') return 'Boleto'
  return 'PIX'
}

function mapExpenseCategory(category: string): Pagamento['categoria'] {
  if (category === 'TAX') return 'IPTU'
  if (category === 'CONDO') return 'Condomínio'
  if (category === 'MAINTENANCE') return 'Manutenção'
  return 'Outro'
}

function mapExpenseStatus(dueDate: string): Pagamento['status'] {
  const due = new Date(dueDate)
  if (due < new Date()) return 'Atrasado'
  return 'Pendente'
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const payments = await goFetch<GoPayment[]>('/api/v1/payments')

  const receitaRealizada = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  const receitaPrevista = payments
    .filter(p => p.status === 'PAID' || p.status === 'PENDING')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  const late = payments.filter(p => p.status === 'LATE').length
  const inadimplenciaPerc = payments.length > 0 ? (late / payments.length) * 100 : 0

  const valorGeralAluguel = payments
    .filter(p => p.type === 'RENT')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  const totalRepassar = payments
    .filter(p => p.status === 'PAID' && p.type === 'RENT')
    .reduce((sum, p) => sum + p.gross_amount, 0)

  return {
    receitaPrevista,
    receitaRealizada,
    inadimplenciaPerc: parseFloat(inadimplenciaPerc.toFixed(1)),
    valorGeralAluguel,
    totalRepassar,
  }
}

export async function getRecebimentos(): Promise<Recebimento[]> {
  const payments = await goFetch<GoPayment[]>('/api/v1/payments')
  return payments
    .filter(p => p.type === 'RENT' || p.type === 'OTHER')
    .map(p => ({
      id: p.id,
      vencimento: p.due_date,
      pagador: p.description ?? `Contrato ${p.lease_id.slice(0, 8)}`,
      imovel: p.competency ?? '—',
      valor: p.gross_amount,
      formaPagto: mapChargeMethod(p.charge_method),
      status: mapPaymentStatus(p.status),
      tipo: mapPaymentType(p.type),
    }))
}

export async function getPagamentos(): Promise<Pagamento[]> {
  const expenses = await goFetch<GoExpense[]>('/api/v1/expenses')
  return expenses.map(e => ({
    id: e.id,
    vencimento: e.due_date,
    fornecedor: e.description,
    categoria: mapExpenseCategory(e.category),
    valor: e.amount,
    imovelVinculado: e.unit_id,
    status: mapExpenseStatus(e.due_date),
  }))
}

// Repasses, comissões e conciliação não têm endpoints no Go API ainda.
// TODO: implementar quando backend tiver endpoints de repasse e comissão.
export async function getRepasses(): Promise<Repasse[]> {
  return []
}

export async function getComissoes(): Promise<Comissao[]> {
  return []
}

export async function getBankRecords(): Promise<BankRecord[]> {
  return []
}
