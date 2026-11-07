// Montagem dos dados do detalhe do contrato (spec lease-management). Funções puras.
import { dailyToMonthly } from './interest'
import { formatDateBR, formatMonthYear, monthName } from './date-format'
import { formatCurrency } from './utils'
import { todaySaoPaulo } from './lease-overview'

export type DetailPayment = {
  id: string
  type: string
  status: string
  due_date: string
  competency?: string | null
  gross_amount: number
}
export type DetailReadjustment = {
  applied_at: string
  old_amount: number
  new_amount: number
  percentage: number
  index_name?: string | null
}

/** 5.1 → "5,1"; 2 → "2"; sem zeros à direita. */
export const fmtPct = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** As `limit` cobranças de aluguel de vencimento mais recente, e o total de aluguéis. */
export function recentRentPayments(payments: DetailPayment[], limit = 4) {
  const rents = payments.filter((p) => p.type === 'RENT').sort((a, b) => b.due_date.localeCompare(a.due_date))
  return { shown: rents.slice(0, limit), total: rents.length }
}

export type PaymentLabel = 'Pago' | 'Atrasado' | 'Previsto'
export function paymentLabel(p: DetailPayment, now: Date = new Date()): PaymentLabel {
  if (p.status === 'PAID') return 'Pago'
  if (p.status === 'LATE' || p.due_date.slice(0, 10) < todaySaoPaulo(now)) return 'Atrasado'
  return 'Previsto'
}

export const paymentMonth = (p: DetailPayment) => {
  const iso = p.competency || p.due_date
  return `${monthName(iso)} ${iso.slice(0, 4)}`
}

export type HistoryRow = { when: string; label: string; percent: string; amount: string }

/** Reajustes do mais novo ao mais antigo, mais a linha "Início" com o aluguel original. */
export function buildReadjustmentHistory(
  lease: { start_date: string; rent_amount: number },
  readjustments: DetailReadjustment[],
): HistoryRow[] {
  const sorted = [...readjustments].sort((a, b) => b.applied_at.localeCompare(a.applied_at))
  const first = sorted[sorted.length - 1]
  const startAmount = first ? first.old_amount : lease.rent_amount
  return [
    ...sorted.map((r) => ({
      when: formatMonthYear(r.applied_at),
      label: r.index_name || '—',
      percent: `${fmtPct(r.percentage * 100)}%`,
      amount: formatCurrency(r.new_amount),
    })),
    { when: formatMonthYear(lease.start_date), label: 'Início', percent: '—', amount: formatCurrency(startAmount) },
  ]
}

export const END_REASON_LABEL: Record<string, string> = {
  TERM_END: 'Fim do prazo',
  TENANT_REQUEST: 'Pedido do inquilino',
  NONPAYMENT: 'Inadimplência',
  OWNER_REQUEST: 'Pedido do proprietário',
  OTHER: 'Outro',
}

export type TermsLease = {
  rent_amount: number
  payment_day?: number
  start_date: string
  end_date?: string | null
  next_readjustment?: string | null
  adjustment_index?: string | null
  late_fee_percent?: number | null
  daily_interest_percent?: number | null
  iptu_reimbursable?: boolean
  annual_iptu_amount?: number | null
}

export function buildTerms(l: TermsLease): { label: string; value: string }[] {
  const period = l.end_date
    ? `${formatDateBR(l.start_date)} a ${formatDateBR(l.end_date)}`
    : `${formatDateBR(l.start_date)} · sem fim`
  const readjust = l.next_readjustment
    ? [formatMonthYear(l.next_readjustment), l.adjustment_index].filter(Boolean).join(' · ')
    : l.adjustment_index || '—'
  return [
    { label: 'Aluguel', value: formatCurrency(l.rent_amount) },
    { label: 'Vencimento', value: l.payment_day ? `todo dia ${l.payment_day}` : '—' },
    { label: 'Período', value: period },
    { label: 'Próx. reajuste', value: readjust },
    { label: 'Multa e juros', value: `${fmtPct(l.late_fee_percent ?? 0)}% + ${fmtPct(dailyToMonthly(l.daily_interest_percent))}% ao mês` },
    {
      label: 'IPTU',
      value: l.iptu_reimbursable
        ? `reembolsável${l.annual_iptu_amount != null ? ` (${formatCurrency(l.annual_iptu_amount)}/ano)` : ''}`
        : 'não reembolsável',
    },
  ]
}
