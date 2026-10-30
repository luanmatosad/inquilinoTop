import { goFetch } from '@/lib/go/client'
import { ReceivablesTable } from '@/components/financial/ReceivablesTable'
import { ErrorState, FilterBar, SummaryCards } from '@/components/financial/shared'
import { parseFilters } from '@/lib/financial-schemas'
import { getReceivablesSummary, listReceivables } from '../actions'

interface Lease {
  id: string
  unit_id: string
  tenant_id: string
}

interface PropertyWithUnits {
  id: string
  name: string
  units: { id: string; label: string }[]
}

async function load<T>(path: string): Promise<T[]> {
  try {
    return (await goFetch<T[]>(path, {})) ?? []
  } catch (error) {
    console.error('Erro ao buscar', path, error)
    return []
  }
}

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; ref?: string }>
}) {
  const filters = parseFilters(await searchParams)

  const [leases, properties, tenants] = await Promise.all([
    load<Lease>('/api/v1/leases'),
    load<PropertyWithUnits>('/api/v1/properties'),
    load<{ id: string; name: string }>('/api/v1/tenants'),
  ])

  const unitLabel = new Map<string, string>()
  for (const p of properties) for (const u of p.units ?? []) unitLabel.set(u.id, `${p.name} - ${u.label}`)
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]))
  const leaseLabels: Record<string, string> = {}
  for (const l of leases) {
    leaseLabels[l.id] = `${unitLabel.get(l.unit_id) ?? 'Unidade'} · ${tenantName.get(l.tenant_id) ?? 'Inquilino'}`
  }

  const [list, summary] = await Promise.all([listReceivables(filters), getReceivablesSummary(filters)])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Contas a Receber</h1>
        <p className="text-muted-foreground">Cobranças de aluguel e encargos, com baixa e recibo</p>
      </div>

      <SummaryCards
        labels={['A receber', 'Vencidas (atualizado)', 'Recebidas']}
        buckets={summary ? [summary.to_receive, summary.overdue, summary.paid] : null}
      />

      <FilterBar
        action="/financial/receivables"
        filters={filters}
        refLabel="Contrato"
        refOptions={Object.entries(leaseLabels).map(([value, label]) => ({ value, label }))}
      />

      {list.data ? (
        <ReceivablesTable rows={list.data} leaseLabels={leaseLabels} />
      ) : (
        <ErrorState message={list.error ?? 'Não foi possível carregar as contas a receber.'} retryHref="/financial/receivables" />
      )}
    </div>
  )
}
