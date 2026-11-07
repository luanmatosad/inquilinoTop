// Linhas e indicadores da lista de contratos (spec lease-overview). Funções puras.

export type OverviewLeaseItem = {
  id: string
  tenant_id: string
  unit_id: string
  status: string
  start_date: string
  end_date?: string | null
  rent_amount: number
  next_readjustment?: string | null
}
type Tenant = { id: string; name: string }
type Property = { id: string; name: string; units?: { id: string; label: string }[] | null }

export type LeaseRow = {
  lease: OverviewLeaseItem
  tenantName: string
  unitLabel: string
  propertyName: string
}

const DASH = '—'

export function buildLeaseRows(input: {
  leases: OverviewLeaseItem[]
  tenants: Tenant[]
  properties: Property[]
}): LeaseRow[] {
  const tenants = new Map(input.tenants.map((t) => [t.id, t.name]))
  const units = new Map<string, { label: string; property: string }>()
  for (const p of input.properties) {
    for (const u of p.units ?? []) units.set(u.id, { label: u.label, property: p.name })
  }
  return input.leases.map((lease) => {
    const u = units.get(lease.unit_id)
    return {
      lease,
      tenantName: tenants.get(lease.tenant_id) || DASH,
      unitLabel: u?.label || DASH,
      propertyName: u?.property || DASH,
    }
  })
}

/** "Hoje" (YYYY-MM-DD) no fuso de São Paulo. */
export function todaySaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now)
}

const addDays = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
const day = (iso: string) => iso.slice(0, 10)

/** Reajuste de um mês anterior ao corrente em contrato ativo. */
export function isReadjustmentPending(l: OverviewLeaseItem, now: Date = new Date()): boolean {
  if (l.status !== 'ACTIVE' || !l.next_readjustment) return false
  return day(l.next_readjustment).slice(0, 7) < todaySaoPaulo(now).slice(0, 7)
}

/** Ativo com reajuste do início do mês corrente até daqui a 90 dias. */
export function isReadjustSoon(l: OverviewLeaseItem, now: Date = new Date()): boolean {
  if (l.status !== 'ACTIVE' || !l.next_readjustment) return false
  const today = todaySaoPaulo(now)
  const r = day(l.next_readjustment)
  return r >= `${today.slice(0, 7)}-01` && r <= addDays(today, 90)
}

export function buildLeaseIndicators(leases: OverviewLeaseItem[], now: Date = new Date()) {
  const today = todaySaoPaulo(now)
  const in30 = addDays(today, 30)
  let activeCount = 0, activeRent = 0, expiring30 = 0, readjust90 = 0, endedCount = 0
  for (const l of leases) {
    if (l.status === 'ENDED') endedCount++
    if (l.status !== 'ACTIVE') continue
    activeCount++
    activeRent += l.rent_amount
    if (l.end_date) {
      const e = day(l.end_date)
      if (e >= today && e <= in30) expiring30++
    }
    if (isReadjustSoon(l, now)) readjust90++
  }
  return { activeCount, activeRent: Math.round(activeRent * 100) / 100, expiring30, readjust90, endedCount }
}
