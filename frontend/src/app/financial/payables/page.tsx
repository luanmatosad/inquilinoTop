import { goFetch } from '@/lib/go/client'
import { ExpenseDialog } from '@/components/expenses/ExpenseDialog'
import { PayablesTable } from '@/components/financial/PayablesTable'
import { LegacyExpensesNotice } from '@/components/financial/LegacyExpensesNotice'
import { ErrorState, FilterBar, SummaryCards } from '@/components/financial/shared'
import { parseFilters } from '@/lib/financial-schemas'
import { getPayablesSummary, listPayables } from '../actions'

interface PropertyWithUnits {
  id: string
  name: string
  units: { id: string; label: string }[]
}

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; ref?: string }>
}) {
  const filters = parseFilters(await searchParams)

  let properties: PropertyWithUnits[] = []
  try {
    properties = (await goFetch<PropertyWithUnits[]>('/api/v1/properties', {})) ?? []
  } catch (error) {
    console.error('Erro ao buscar imóveis:', error)
  }
  const unitLabels: Record<string, string> = {}
  for (const p of properties) for (const u of p.units ?? []) unitLabels[u.id] = `${p.name} - ${u.label}`

  const [list, summary] = await Promise.all([listPayables(filters), getPayablesSummary(filters)])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contas a Pagar</h1>
          <p className="text-muted-foreground">Despesas por unidade, com baixa e estorno</p>
        </div>
        <ExpenseDialog properties={properties} />
      </div>

      <SummaryCards
        labels={['A vencer', 'Vencidas', 'Pagas']}
        buckets={summary ? [summary.to_pay, summary.overdue, summary.paid] : null}
      />

      <FilterBar
        action="/financial/payables"
        filters={filters}
        refLabel="Unidade"
        refOptions={Object.entries(unitLabels).map(([value, label]) => ({ value, label }))}
      />

      <LegacyExpensesNotice lateCount={summary?.overdue.count ?? 0} />

      {list.data ? (
        <PayablesTable rows={list.data} unitLabels={unitLabels} />
      ) : (
        <ErrorState message={list.error ?? 'Não foi possível carregar as contas a pagar.'} retryHref="/financial/payables" />
      )}
    </div>
  )
}
