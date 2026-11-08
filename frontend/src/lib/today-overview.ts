// Tela Hoje (spec today-overview e getting-started): listas, contagem, saudação e primeiros passos.
// Funções puras; as buscas ficam na página. Reaproveita as regras de Recebimentos e de Contratos para os números
// baterem entre as telas.
import { buildReceivableRows, receivableIndicators, type OverviewPayment } from './financial-overview'
import { buildLeaseRows, isReadjustmentPending, todaySaoPaulo, type OverviewLeaseItem } from './lease-overview'

const SP = 'America/Sao_Paulo'

// ---------- Saudação, data e frase ----------

function hourSaoPaulo(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: SP, hour: '2-digit', hour12: false }).format(now)) % 24
}

/** Bom dia até 11:59, boa tarde até 17:59 e boa noite no resto (horário de São Paulo). */
export function greeting(now: Date = new Date()): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const h = hourSaoPaulo(now)
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** "Segunda-feira, 2 de novembro". */
export function dateLabel(now: Date = new Date()): string {
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: SP, weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  const text = s.replace(',', '')
  const [weekday, ...rest] = text.split(' ')
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${rest.join(' ')}`
}

export function headline(count: number): string {
  if (count === 0) return 'Nada para resolver hoje.'
  return `Você tem ${count} ${count === 1 ? 'coisa' : 'coisas'} para resolver hoje.`
}

// ---------- Listas do dia ----------

export const COLLECT_WINDOW_DAYS = 7
export const READJUST_WINDOW_DAYS = 30
export const ENDING_WINDOW_DAYS = 60

const day = (iso: string) => iso.slice(0, 10)
const diffDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const round2 = (n: number) => Math.round(n * 100) / 100

export type TodayRow = {
  id: string
  tenant: string
  where: string
  /** Valor bruto da cobrança (o mesmo dos indicadores). */
  amount: number
  /** Valor devido hoje (bruto, mais multa e juros se atrasada). */
  totalDue: number
  /** AAAA-MM-DD. */
  due: string
  daysLate: number
  daysUntil: number
  reportedAt?: string
  reportedAmount?: number
  hasProof?: boolean
}

export type WatchItem = {
  kind: 'READJUST' | 'ENDING'
  leaseId: string
  where: string
  /** AAAA-MM-DD do reajuste ou do término. */
  date: string
  /** Só reajuste: índice do contrato (IGPM, IPCA). */
  index?: string
  /** Só reajuste: já passou do mês previsto. */
  pending?: boolean
  /** Só término: dias até acabar. */
  days?: number
}

export type TodayLease = OverviewLeaseItem & { adjustment_index?: string | null }

export function buildToday(input: {
  payments: OverviewPayment[]
  leases: TodayLease[]
  tenants: { id: string; name: string }[]
  properties: { id: string; name: string; units?: { id: string; label: string }[] | null }[]
  now?: Date
}) {
  const now = input.now ?? new Date()
  const today = todaySaoPaulo(now)
  const rows = buildReceivableRows(input)

  const toRow = (r: (typeof rows)[number]): TodayRow => {
    const p = r.payment
    const due = day(p.due_date)
    const late = p.status === 'LATE' ? (p.late_fee_amount ?? 0) + (p.interest_amount ?? 0) : 0
    return {
      id: p.id,
      tenant: r.tenantName,
      where: r.where,
      amount: p.gross_amount,
      totalDue: round2(p.gross_amount + late),
      due,
      daysLate: Math.max(0, diffDays(due, today)),
      daysUntil: Math.max(0, diffDays(today, due)),
      reportedAt: p.reported_at,
      reportedAmount: p.reported_amount,
      hasProof: p.has_proof,
    }
  }

  const confirm = rows
    .filter((r) => r.situation === 'AWAITING')
    .map(toRow)
    .sort((a, b) => (a.reportedAt ?? '').localeCompare(b.reportedAt ?? ''))
  const late = rows
    .filter((r) => r.situation === 'LATE')
    .map(toRow)
    .sort((a, b) => b.daysLate - a.daysLate)
  const collect = rows
    .filter((r) => r.situation === 'PENDING')
    .map(toRow)
    .filter((r) => r.daysUntil <= COLLECT_WINDOW_DAYS && r.due >= today)
    .sort((a, b) => a.due.localeCompare(b.due))

  const k = receivableIndicators(rows)
  const kpis = {
    forecast: k.forecast,
    received: k.received,
    late: k.late,
    receivedPercent: k.forecast.total > 0 ? Math.round((k.received.total / k.forecast.total) * 100) : 0,
    oldestLateDays: late[0]?.daysLate ?? 0,
  }

  const leaseRows = buildLeaseRows({ leases: input.leases, tenants: input.tenants, properties: input.properties })
  const readjust: WatchItem[] = []
  const ending: WatchItem[] = []
  for (const lr of leaseRows) {
    const l = lr.lease as TodayLease
    if (l.status !== 'ACTIVE') continue
    const where = lr.unitLabel === '—' ? '—' : `${lr.unitLabel} · ${lr.propertyName}`
    if (l.next_readjustment) {
      const date = day(l.next_readjustment)
      const pending = isReadjustmentPending(l, now)
      if (pending || (date >= today && date <= addDays(today, READJUST_WINDOW_DAYS))) {
        readjust.push({ kind: 'READJUST', leaseId: l.id, where, date, index: l.adjustment_index ?? undefined, pending })
      }
    }
    if (l.end_date) {
      const end = day(l.end_date)
      if (end >= today && end <= addDays(today, ENDING_WINDOW_DAYS)) {
        ending.push({ kind: 'ENDING', leaseId: l.id, where, date: end, days: diffDays(today, end) })
      }
    }
  }
  readjust.sort((a, b) => a.date.localeCompare(b.date))
  ending.sort((a, b) => a.date.localeCompare(b.date))
  const watch = [...readjust, ...ending]

  return { confirm, late, collect, watch, kpis, count: confirm.length + late.length + collect.length + watch.length }
}

// ---------- Primeiros passos ----------

export type ChecklistStep = {
  key: 'account' | 'property' | 'tenant' | 'lease' | 'pix'
  title: string
  hint: string
  done: boolean
  /** Passo que ainda não dá para fazer (contrato sem imóvel e inquilino). */
  blocked: boolean
  href?: string
  cta?: string
}

export function buildChecklist(c: { properties: number; tenants: number; leases: number; hasPix: boolean }) {
  const steps: ChecklistStep[] = [
    { key: 'account', title: 'Criar sua conta', hint: 'Feito.', done: true, blocked: false },
    {
      key: 'property',
      title: 'Cadastrar o primeiro imóvel',
      hint: 'Endereço e tipo. Se tiver várias unidades, você cadastra depois.',
      done: c.properties > 0,
      blocked: false,
      href: '/properties?novo=1',
      cta: 'Cadastrar imóvel',
    },
    {
      key: 'tenant',
      title: 'Cadastrar um inquilino',
      hint: 'Nome e contato já bastam.',
      done: c.tenants > 0,
      blocked: false,
      href: '/tenants?novo=1',
      cta: 'Cadastrar',
    },
    {
      key: 'lease',
      title: 'Criar o contrato',
      hint: c.properties > 0 && c.tenants > 0 ? 'Liga a unidade ao inquilino e gera as cobranças.' : 'Precisa de imóvel e inquilino.',
      done: c.leases > 0,
      blocked: c.properties === 0 || c.tenants === 0,
      href: '/leases?novo=1',
      cta: 'Criar contrato',
    },
    {
      key: 'pix',
      title: 'Definir como você recebe',
      hint: 'Sua chave Pix padrão. O dinheiro vai direto para a sua conta.',
      done: c.hasPix,
      blocked: false,
      href: '/settings/financial',
      cta: 'Configurar Pix',
    },
  ]
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length }
}
