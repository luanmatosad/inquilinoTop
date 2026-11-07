import Link from 'next/link'

import { goFetch } from '@/lib/go/client'
import { formatCurrency } from '@/lib/utils'
import {
  buildReceivableRows,
  chipCounts,
  filterBySituation,
  monthRange,
  parseMonth,
  receivableIndicators,
  type OverviewPayment,
} from '@/lib/financial-overview'
import { Button } from '@/components/ui/button'
import { FinancialKpis } from '@/components/financial/FinancialKpis'
import { MonthNav } from '@/components/financial/MonthNav'
import { ReceivablesList, type ReceivableItem } from '@/components/financial/ReceivablesList'
import { SituationChips } from '@/components/financial/SituationChips'
import { plural } from '@/lib/property-format'

const BASE = '/financial/receivables'

type ApiLease = { id: string; tenant_id: string; unit_id: string }
type ApiTenant = { id: string; name: string }
type ApiProperty = { id: string; name: string; units?: { id: string; label: string }[] | null }

const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">{children}</div>
}

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ mes?: string; situacao?: string }> }) {
  const { mes, situacao } = await searchParams
  const ym = parseMonth(mes)
  const { from, to } = monthRange(ym)

  // Cobranças (do mês e atrasadas) são obrigatórias; contratos, inquilinos e imóveis só enriquecem as linhas.
  const [monthRes, lateRes, leasesRes, tenantsRes, propertiesRes] = await Promise.allSettled([
    goFetch<OverviewPayment[]>(`/api/v1/payments?from=${from}&to=${to}`, {}),
    goFetch<OverviewPayment[]>('/api/v1/payments?status=LATE', {}),
    goFetch<ApiLease[]>('/api/v1/leases', {}),
    goFetch<ApiTenant[]>('/api/v1/tenants', {}),
    goFetch<ApiProperty[]>('/api/v1/properties', {}),
  ])

  const heading = (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-tight">Recebimentos</h1>
        <p className="text-sm text-muted-foreground">Aluguéis do mês e o que está em atraso.</p>
      </div>
      <MonthNav basePath={BASE} ym={ym} situacao={situacao} />
    </div>
  )

  if (monthRes.status === 'rejected' || lateRes.status === 'rejected') {
    console.error('Erro ao buscar recebimentos:', monthRes.status === 'rejected' ? monthRes.reason : (lateRes as PromiseRejectedResult).reason)
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {heading}
        <Message>
          <p className="text-muted-foreground">Não foi possível carregar os recebimentos.</p>
          <Button asChild variant="outline">
            <Link href={`${BASE}?mes=${ym}`}>Tentar novamente</Link>
          </Button>
        </Message>
      </div>
    )
  }

  const optional = [['contratos', leasesRes], ['inquilinos', tenantsRes], ['imóveis', propertiesRes]] as const
  for (const [name, r] of optional) if (r.status === 'rejected') console.error(`Erro ao buscar ${name}:`, r.reason)
  const missing = optional.filter(([, r]) => r.status === 'rejected').map(([n]) => n)

  const all = buildReceivableRows({
    payments: [...(monthRes.value ?? []), ...(lateRes.value ?? [])],
    leases: leasesRes.status === 'fulfilled' ? (leasesRes.value ?? []) : [],
    tenants: tenantsRes.status === 'fulfilled' ? (tenantsRes.value ?? []) : [],
    properties: propertiesRes.status === 'fulfilled' ? (propertiesRes.value ?? []) : [],
  })
  const k = receivableIndicators(all)
  const counts = chipCounts(all)
  const shown = filterBySituation(all, situacao)

  const toItem = (r: (typeof all)[number]): ReceivableItem => {
    const p = r.payment
    return {
      id: p.id,
      tenant: r.tenantName,
      where: r.where,
      due: dayMonth(p.due_date),
      amount: formatCurrency(p.gross_amount),
      grossAmount: p.gross_amount,
      updatedTotal:
        r.situation === 'LATE' ? formatCurrency(p.gross_amount + (p.late_fee_amount ?? 0) + (p.interest_amount ?? 0)) : undefined,
      situation: r.situation,
    }
  }

  const kpis = [
    { label: 'Previsto', value: formatCurrency(k.forecast.total), sub: plural(k.forecast.count, 'cobrança', 'cobranças') },
    { label: 'Recebido', value: formatCurrency(k.received.total), sub: `${k.received.count} de ${k.forecast.count} pagas` },
    {
      label: 'Em atraso',
      value: formatCurrency(k.late.total),
      sub: k.late.count ? plural(k.late.count, 'cobrança', 'cobranças') : 'nenhuma cobrança',
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {heading}
      <FinancialKpis kpis={kpis} mobile={[kpis[1], kpis[0]]} />
      {missing.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Dados indisponíveis no momento ({missing.join(', ')}): inquilino e imóvel podem aparecer como “—”.
        </p>
      )}

      {all.length === 0 ? (
        <Message>
          <div className="text-base font-semibold">Nenhuma cobrança neste mês</div>
          <p className="max-w-md text-sm text-muted-foreground">As cobranças nascem dos contratos. Crie um contrato com a geração de cobranças ligada.</p>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/leases">Ver contratos</Link>
          </Button>
        </Message>
      ) : (
        <>
          <SituationChips
            basePath={BASE}
            ym={ym}
            active={situacao}
            chips={[
              { value: '', label: 'Todas', count: counts.ALL },
              { value: 'LATE', label: 'Atrasadas', count: counts.LATE },
              { value: 'PAID', label: 'Pagas', count: counts.PAID },
              { value: 'PENDING', label: 'Previstas', count: counts.PENDING },
            ]}
          />
          {shown.length === 0 && (
            <Message>
              <p className="text-muted-foreground">Nenhuma cobrança encontrada.</p>
            </Message>
          )}
          <ReceivablesList rows={shown.map(toItem)} openRows={all.filter((r) => r.situation !== 'PAID').map(toItem)} />
        </>
      )}
    </div>
  )
}
