// Extrato do inquilino (spec tenant-statement): período, situação das linhas, indicadores, acordos e reajustes.
// Funções puras; as buscas ficam na página.
import { MONTHS, formatMonthYear } from './date-format'
import { monthRange, shiftMonth } from './financial-overview'
import { todaySaoPaulo } from './lease-overview'

const day = (iso: string) => iso.slice(0, 10)
const diffDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
const round2 = (n: number) => Math.round(n * 100) / 100
const YM = /^\d{4}-(0[1-9]|1[0-2])$/

export type StatementPayment = {
  id: string
  lease_id: string
  type: string
  status: string
  due_date: string
  paid_date?: string | null
  original_due_date?: string | null
  gross_amount: number
  net_amount?: number | null
  late_fee_amount?: number
  interest_amount?: number
  awaiting_confirmation?: boolean
}

// ---------- Período ----------

export type Period = { kind: '12m' | 'year' | 'custom'; from: string; to: string; year?: number }

export function parsePeriod(
  q: { periodo?: string; de?: string; ate?: string },
  now: Date = new Date(),
): Period {
  const cur = todaySaoPaulo(now).slice(0, 7)
  if (q.periodo && /^\d{4}$/.test(q.periodo)) {
    return { kind: 'year', from: `${q.periodo}-01-01`, to: `${q.periodo}-12-31`, year: Number(q.periodo) }
  }
  if (q.periodo === 'custom' && q.de && q.ate && YM.test(q.de) && YM.test(q.ate) && q.de <= q.ate) {
    return { kind: 'custom', from: monthRange(q.de).from, to: monthRange(q.ate).to }
  }
  return { kind: '12m', from: monthRange(shiftMonth(cur, -11)).from, to: monthRange(cur).to }
}

// ---------- Linhas ----------

export type RowSituation = 'PAID' | 'PAID_LATE' | 'LATE' | 'AWAITING' | 'PENDING'

export function rowSituation(p: StatementPayment): RowSituation {
  if (p.status === 'PAID') return p.paid_date && day(p.paid_date) > day(p.due_date) ? 'PAID_LATE' : 'PAID'
  if (p.awaiting_confirmation) return 'AWAITING'
  return p.status === 'LATE' ? 'LATE' : 'PENDING'
}

export type StatementRow = { payment: StatementPayment; situation: RowSituation; amount: number }

export function buildStatementRows(payments: StatementPayment[]): StatementRow[] {
  const seen = new Map<string, StatementPayment>()
  for (const p of payments) if (p.type === 'RENT' && !seen.has(p.id)) seen.set(p.id, p)
  return [...seen.values()]
    .sort((a, b) => day(b.due_date).localeCompare(day(a.due_date)))
    .map((payment) => {
      const situation = rowSituation(payment)
      const paid = situation === 'PAID' || situation === 'PAID_LATE'
      return { payment, situation, amount: paid ? (payment.net_amount ?? payment.gross_amount) : payment.gross_amount }
    })
}

const isPaid = (r: StatementRow) => r.situation === 'PAID' || r.situation === 'PAID_LATE'

// ---------- Indicadores ----------

export function statementIndicators(rows: StatementRow[], now: Date = new Date()) {
  const paid = rows.filter(isPaid)
  const late = paid.filter((r) => r.situation === 'PAID_LATE').length
  const overdue = rows.filter((r) => r.situation === 'LATE')
  let overdueNow: { total: number; count: number; days: number; month: string } | null = null
  if (overdue.length) {
    const oldest = overdue.reduce((a, b) => (day(b.payment.due_date) < day(a.payment.due_date) ? b : a))
    const due = day(oldest.payment.due_date)
    overdueNow = {
      total: round2(
        overdue.reduce((s, r) => s + r.payment.gross_amount + (r.payment.late_fee_amount ?? 0) + (r.payment.interest_amount ?? 0), 0),
      ),
      count: overdue.length,
      days: Math.max(0, diffDays(due, todaySaoPaulo(now))),
      month: MONTHS[Number(due.slice(5, 7)) - 1],
    }
  }
  return {
    received: { total: round2(paid.reduce((s, r) => s + r.amount, 0)), count: paid.length },
    punctual: { onTime: paid.length - late, paid: paid.length, late },
    overdueNow,
    lateCount: late,
  }
}

// ---------- Acordos, reajustes, cobrança ----------

export function agreementsOf(payments: StatementPayment[]) {
  return payments
    .filter((p) => p.original_due_date && day(p.original_due_date) !== day(p.due_date))
    .sort((a, b) => day(b.due_date).localeCompare(day(a.due_date)))
    .map((p) => ({ id: p.id, from: day(p.original_due_date!), to: day(p.due_date) }))
}

export type ApiReadjustment = { applied_at: string; old_amount: number; new_amount: number }

export function readjustmentsOf(items: ApiReadjustment[]) {
  return [...items]
    .sort((a, b) => b.applied_at.localeCompare(a.applied_at))
    .map((r) => ({ month: formatMonthYear(r.applied_at), oldAmount: r.old_amount, newAmount: r.new_amount }))
}

/** Cobrança não paga mais antiga (alvo do botão Cobrar). */
export function oldestOpen(rows: StatementRow[]): StatementRow | null {
  const open = rows.filter((r) => !isPaid(r))
  if (!open.length) return null
  return open.reduce((a, b) => (day(b.payment.due_date) < day(a.payment.due_date) ? b : a))
}

// ---------- Linhas visíveis ----------

const VISIBLE_ROWS = 6

export function visibleRows(rows: StatementRow[], all: boolean) {
  const shown = all ? rows : rows.slice(0, VISIBLE_ROWS)
  return {
    rows: shown,
    label: `Mostrando ${shown.length} dos ${rows.length} meses`,
    hasMore: !all && rows.length > VISIBLE_ROWS,
  }
}
