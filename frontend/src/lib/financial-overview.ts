// Linhas, indicadores, situação e mês de Recebimentos e Despesas (specs receivables-overview e
// payables-overview). Funções puras; as buscas ficam nas páginas.
// shortcut: junção no servidor Next porque /payments, /expenses, /leases e /properties não paginam;
// se a base passar de alguns milhares de registros, mover para o backend.
import { MONTHS } from './date-format'
import { todaySaoPaulo } from './lease-overview'

// ---------- Mês ----------

const YM = /^(\d{4})-(0[1-9]|1[0-2])$/

/** `?mes=AAAA-MM` válido, ou o mês corrente em São Paulo. */
export function parseMonth(mes?: string | null, now: Date = new Date()): string {
  return mes && YM.test(mes) ? mes : todaySaoPaulo(now).slice(0, 7)
}

export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const formatMonthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`

// ---------- Comum ----------

export type Situation = 'LATE' | 'PAID' | 'PENDING'
export type Bucket = { total: number; count: number }
const DASH = '—'
const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100
const bucket = (xs: number[]): Bucket => ({ total: sum(xs), count: xs.length })
const situationOf = (status: string): Situation => (status === 'PAID' ? 'PAID' : status === 'LATE' ? 'LATE' : 'PENDING')

type Property = { id: string; name: string; units?: { id: string; label: string }[] | null }

function unitIndex(properties: Property[]) {
  const m = new Map<string, { label: string; property: string }>()
  for (const p of properties) for (const u of p.units ?? []) m.set(u.id, { label: u.label, property: p.name })
  return m
}

/** Remove repetidos por `id` (mês e atrasadas podem trazer a mesma linha) e ordena por vencimento. */
function uniqueByDue<T>(items: T[], id: (t: T) => string, due: (t: T) => string): T[] {
  const seen = new Map<string, T>()
  for (const it of items) if (!seen.has(id(it))) seen.set(id(it), it)
  return [...seen.values()].sort((a, b) => due(a).localeCompare(due(b)))
}

// ---------- Recebimentos ----------

export type OverviewPayment = {
  id: string
  lease_id: string
  type: string
  status: string
  due_date: string
  gross_amount: number
  late_fee_amount?: number
  interest_amount?: number
}
type OverviewLease = { id: string; tenant_id: string; unit_id: string }

export type ReceivableRowView = {
  payment: OverviewPayment
  tenantName: string
  /** "Ap 302 · Ed. Aurora" ou "—". */
  where: string
  situation: Situation
}

export function buildReceivableRows(input: {
  payments: OverviewPayment[]
  leases: OverviewLease[]
  tenants: { id: string; name: string }[]
  properties: Property[]
}): ReceivableRowView[] {
  const leases = new Map(input.leases.map((l) => [l.id, l]))
  const tenants = new Map(input.tenants.map((t) => [t.id, t.name]))
  const units = unitIndex(input.properties)
  const rents = input.payments.filter((p) => p.type === 'RENT')
  return uniqueByDue(rents, (p) => p.id, (p) => p.due_date).map((payment) => {
    const lease = leases.get(payment.lease_id)
    const unit = lease ? units.get(lease.unit_id) : undefined
    return {
      payment,
      tenantName: (lease && tenants.get(lease.tenant_id)) || DASH,
      where: unit ? `${unit.label} · ${unit.property}` : DASH,
      situation: situationOf(payment.status),
    }
  })
}

export function receivableIndicators(rows: ReceivableRowView[]) {
  const amounts = (s?: Situation) => rows.filter((r) => !s || r.situation === s).map((r) => r.payment.gross_amount)
  return { forecast: bucket(amounts()), received: bucket(amounts('PAID')), late: bucket(amounts('LATE')) }
}

export type ReceivableChip = 'ALL' | Situation
export const chipCounts = (rows: ReceivableRowView[]): Record<ReceivableChip, number> => ({
  ALL: rows.length,
  LATE: rows.filter((r) => r.situation === 'LATE').length,
  PAID: rows.filter((r) => r.situation === 'PAID').length,
  PENDING: rows.filter((r) => r.situation === 'PENDING').length,
})

/** Valor desconhecido de `?situacao=` vira "sem filtro". */
export function filterBySituation(rows: ReceivableRowView[], situacao?: string): ReceivableRowView[] {
  return situacao === 'LATE' || situacao === 'PAID' || situacao === 'PENDING' ? rows.filter((r) => r.situation === situacao) : rows
}

// ---------- Despesas ----------

export type OverviewExpense = {
  id: string
  unit_id: string
  description: string
  amount: number
  due_date: string
  category: string
  status: string
  paid_date?: string | null
}

export const CATEGORY_LABEL: Record<string, string> = {
  ELECTRICITY: 'Energia',
  WATER: 'Água',
  CONDO: 'Condomínio',
  TAX: 'Impostos',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outros',
}

export type PayableRowView = {
  expense: OverviewExpense
  where: string
  categoryLabel: string
  situation: Situation
}

export function buildPayableRows(input: { expenses: OverviewExpense[]; properties: Property[] }): PayableRowView[] {
  const units = unitIndex(input.properties)
  return uniqueByDue(input.expenses, (e) => e.id, (e) => e.due_date).map((expense) => {
    const unit = units.get(expense.unit_id)
    return {
      expense,
      where: unit ? `${unit.label} · ${unit.property}` : DASH,
      categoryLabel: CATEGORY_LABEL[expense.category] ?? CATEGORY_LABEL.OTHER,
      situation: situationOf(expense.status),
    }
  })
}

export function payableIndicators(rows: PayableRowView[]) {
  const amounts = (f: (r: PayableRowView) => boolean) => rows.filter(f).map((r) => r.expense.amount)
  return {
    total: bucket(amounts(() => true)),
    paid: bucket(amounts((r) => r.situation === 'PAID')),
    toPay: bucket(amounts((r) => r.situation !== 'PAID')),
  }
}

/** Em Despesas, "A pagar" (`PENDING`) agrupa as pendentes e as atrasadas. */
export function filterPayables(rows: PayableRowView[], situacao?: string): PayableRowView[] {
  if (situacao === 'PAID') return rows.filter((r) => r.situation === 'PAID')
  if (situacao === 'PENDING') return rows.filter((r) => r.situation !== 'PAID')
  return rows
}

export const payableChipCounts = (rows: PayableRowView[]) => ({
  ALL: rows.length,
  PENDING: rows.filter((r) => r.situation !== 'PAID').length,
  PAID: rows.filter((r) => r.situation === 'PAID').length,
})
