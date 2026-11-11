// Visão geral por inquilino: contrato atual, imóvel/unidade e situação de cobrança do mês
// (spec tenant-overview). Função pura; as buscas ficam na página.
// shortcut: junção no servidor Next porque /leases, /properties e /payments não paginam; se a base
// passar de alguns milhares de registros, mover para o backend (ver design.md da change).

type OverviewTenant = { id: string }
export type OverviewLease = {
  id: string
  tenant_id: string
  unit_id: string
  status: string
  start_date: string
  rent_amount?: number
  payment_day?: number
}
export type OverviewProperty = {
  id: string
  name: string
  units?: { id: string; label: string }[] | null
}
export type OverviewPayment = {
  lease_id: string
  status: string
  type: string
  due_date: string
  gross_amount: number
}

/** `NO_LEASE` = sem contrato ativo; `null` = tem contrato mas nada cobrado no mês (exibido como "—"). */
export type BillingStatus = 'LATE' | 'PAID' | 'PENDING' | 'NO_LEASE' | null

export type TenantOverview = {
  lease: OverviewLease | null
  unit: { id: string; label: string } | null
  property: { id: string; name: string } | null
  billing: BillingStatus
  /** Aluguel (`RENT`) do mês corrente no contrato atual, para o cartão "Cobrança do mês". */
  monthPayment: OverviewPayment | null
}

type Input = {
  tenants: OverviewTenant[]
  leases: OverviewLease[]
  properties: OverviewProperty[]
  /** Pagamentos com vencimento no mês corrente (`GET /payments?from&to`). */
  monthPayments: OverviewPayment[]
  /** Pagamentos vencidos e não pagos de qualquer mês (`GET /payments?status=LATE`). */
  latePayments: OverviewPayment[]
}

export function buildTenantOverview(input: Input): Map<string, TenantOverview> {
  const { tenants, leases, properties, monthPayments, latePayments } = input

  const activeByTenant = new Map<string, OverviewLease[]>()
  for (const l of leases) {
    if (l.status !== 'ACTIVE') continue
    const list = activeByTenant.get(l.tenant_id) ?? []
    list.push(l)
    activeByTenant.set(l.tenant_id, list)
  }

  const unitIndex = new Map<string, { unit: { id: string; label: string }; property: { id: string; name: string } }>()
  for (const p of properties) {
    for (const u of p.units ?? []) {
      unitIndex.set(u.id, { unit: { id: u.id, label: u.label }, property: { id: p.id, name: p.name } })
    }
  }

  const allPayments = [...monthPayments, ...latePayments]
  const result = new Map<string, TenantOverview>()

  for (const t of tenants) {
    const active = activeByTenant.get(t.id) ?? []
    // Contrato atual: o ACTIVE de start_date mais recente.
    const lease = active.reduce<OverviewLease | null>((best, l) => (!best || l.start_date > best.start_date ? l : best), null)

    if (!lease) {
      result.set(t.id, { lease: null, unit: null, property: null, billing: 'NO_LEASE', monthPayment: null })
      continue
    }

    const where = unitIndex.get(lease.unit_id)
    const activeIds = new Set(active.map((l) => l.id))

    // Vencimento do aluguel do mês no contrato atual (o mais recente, se houver mais de um).
    const monthPayment = monthPayments
      .filter((p) => p.lease_id === lease.id && p.type === 'RENT')
      .reduce<OverviewPayment | null>((best, p) => (!best || p.due_date > best.due_date ? p : best), null)

    let billing: BillingStatus = null
    if (allPayments.some((p) => p.status === 'LATE' && activeIds.has(p.lease_id))) billing = 'LATE'
    else if (monthPayment?.status === 'PAID') billing = 'PAID'
    else if (monthPayment?.status === 'PENDING') billing = 'PENDING'

    result.set(t.id, {
      lease,
      unit: where?.unit ?? null,
      property: where?.property ?? null,
      billing,
      monthPayment,
    })
  }

  return result
}

/** Primeiro e último dia do mês corrente em `America/Sao_Paulo` (mesmo fuso padrão do backend). */
export function currentMonthRange(now: Date = new Date(), timeZone = 'America/Sao_Paulo'): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now)
  const year = Number(parts.find((p) => p.type === 'year')!.value)
  const month = Number(parts.find((p) => p.type === 'month')!.value)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const mm = String(month).padStart(2, '0')
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` }
}
