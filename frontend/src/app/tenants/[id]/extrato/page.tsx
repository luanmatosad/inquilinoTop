import Link from 'next/link'
import { notFound } from 'next/navigation'

import { goFetch } from '@/lib/go/client'
import { formatCurrency } from '@/lib/utils'
import { formatDateBR, formatMonthYear } from '@/lib/date-format'
import { todaySaoPaulo } from '@/lib/lease-overview'
import type { OverviewLease, OverviewProperty } from '@/lib/tenant-overview'
import {
  agreementsOf,
  buildStatementRows,
  oldestOpen,
  parsePeriod,
  readjustmentsOf,
  statementIndicators,
  visibleRows,
  type ApiReadjustment,
  type StatementPayment,
} from '@/lib/tenant-statement'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BillingBadge, type BillingDisplay } from '@/components/tenants/BillingBadge'
import { TenantTabs } from '@/components/tenants/TenantTabs'
import { PeriodFilter, StatementKpis, StatementTable } from '@/components/tenants/StatementParts'
import { PrintButton } from '@/components/financial/PrintButton'

type Lease = OverviewLease & { next_readjustment?: string | null }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">{children}</CardContent>
      </Card>
    </section>
  )
}

export default async function TenantStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; todos?: string }>
}) {
  const { id } = await params
  const q = await searchParams
  const now = new Date()
  const period = parsePeriod(q, now)

  let tenant: { id: string; name: string } | undefined
  try {
    tenant = await goFetch<{ id: string; name: string }>('/api/v1/tenants/' + id, {})
  } catch (error) {
    console.error('Erro ao buscar inquilino:', error)
  }
  if (!tenant) notFound()

  const [leasesRes, propertiesRes] = await Promise.allSettled([
    goFetch<Lease[]>('/api/v1/leases', {}),
    goFetch<OverviewProperty[]>('/api/v1/properties', {}),
  ])
  const leasesOk = leasesRes.status === 'fulfilled'
  const leases = leasesOk ? (leasesRes.value ?? []).filter((l) => l.tenant_id === id) : []
  const properties = propertiesRes.status === 'fulfilled' ? (propertiesRes.value ?? []) : []

  // Contrato atual: o ACTIVE mais recente; sem ativo, o mais recente.
  const byStart = [...leases].sort((a, b) => b.start_date.localeCompare(a.start_date))
  const lease = byStart.find((l) => l.status === 'ACTIVE') ?? byStart[0] ?? null

  const [payRes, readjRes] = await Promise.all([
    Promise.allSettled(
      leases.map((l) => goFetch<StatementPayment[]>(`/api/v1/payments?lease_id=${l.id}&from=${period.from}&to=${period.to}`, {})),
    ),
    lease ? Promise.allSettled([goFetch<ApiReadjustment[]>(`/api/v1/leases/${lease.id}/readjustments`, {})]) : Promise.resolve([]),
  ])
  const paymentsOk = payRes.every((r) => r.status === 'fulfilled')
  const payments = payRes.flatMap((r) => (r.status === 'fulfilled' ? (r.value ?? []) : []))
  const readj = readjRes[0]?.status === 'fulfilled' ? readjustmentsOf(readjRes[0].value ?? []) : []

  const rows = buildStatementRows(payments)
  const k = statementIndicators(rows, now)
  const view = visibleRows(rows, q.todos === '1')
  const agreements = agreementsOf(payments)
  const open = oldestOpen(rows)
  const unit = lease ? properties.flatMap((p) => (p.units ?? []).map((u) => ({ ...u, property: p.name }))).find((u) => u.id === lease.unit_id) : undefined
  const noLease = leasesOk && !lease
  const billing: BillingDisplay = !leasesOk || !paymentsOk ? 'UNAVAILABLE' : k.overdueNow ? 'LATE' : rows.length ? 'PAID' : null
  const currentYear = Number(todaySaoPaulo(now).slice(0, 4))

  const todosParams = new URLSearchParams()
  for (const key of ['periodo', 'de', 'ate'] as const) if (q[key]) todosParams.set(key, q[key]!)
  todosParams.set('todos', '1')

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-1">
          <nav aria-label="Navegação" className="text-sm text-muted-foreground print:hidden">
            <Link href="/tenants" className="hover:underline">
              Inquilinos
            </Link>{' '}
            › Extrato
          </nav>
          <h1 className="text-2xl font-semibold leading-[1.2]">{tenant.name}</h1>
          {lease && (
            <p className="text-sm text-muted-foreground">
              {unit ? `${unit.label} · ${unit.property} · ` : ''}contrato desde {formatDateBR(lease.start_date)}
            </p>
          )}
          <div role="group" aria-label="Situação de cobrança" className="pt-1">
            {noLease ? <Badge variant="outline">Sem contrato</Badge> : <BillingBadge status={billing} />}
          </div>
        </div>
        {!noLease && (
          <div className="ml-auto flex flex-wrap gap-2 print:hidden">
            <PrintButton label="Exportar PDF" />
            {open && (
              <Button asChild>
                <Link href={`/financial/receivables/${open.payment.id}?enviar=1`}>Cobrar</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <TenantTabs id={id} active="extrato" />

      {!leasesOk && (
        <p role="status" className="text-sm text-muted-foreground">
          Contratos indisponíveis no momento. Tente recarregar a página.
        </p>
      )}
      {leasesOk && !paymentsOk && (
        <p role="status" className="text-sm text-muted-foreground">
          Parte dos pagamentos está indisponível no momento. Os números podem estar incompletos.
        </p>
      )}

      {noLease ? (
        <Card className="p-4 text-sm text-muted-foreground">Sem contrato. Para gerar cobranças, ligue este inquilino a uma unidade.</Card>
      ) : (
        leasesOk && (
          <>
            <StatementKpis k={k} />
            <PeriodFilter id={id} period={period} currentYear={currentYear} />
            <Card size="flush">
              <StatementTable rows={view.rows} />
              <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
                <span>{view.label}</span>
                {view.hasMore && (
                  <Link href={`/tenants/${id}/extrato?${todosParams.toString()}`} className="font-medium text-foreground hover:underline print:hidden">
                    Ver todos
                  </Link>
                )}
              </div>
            </Card>
            <div className="grid gap-4 md:grid-cols-3">
              <Section title="Contrato">
                <span>{lease?.rent_amount != null ? `${formatCurrency(lease.rent_amount)} por mês` : '—'}</span>
                <span className="text-muted-foreground">{lease?.payment_day ? `Vence todo dia ${lease.payment_day}` : '—'}</span>
                <span className="text-muted-foreground">Próximo reajuste em {formatMonthYear(lease?.next_readjustment)}</span>
              </Section>
              <Section title="Reajustes">
                {readj.length ? (
                  readj.map((r) => (
                    <span key={r.month + r.newAmount}>
                      {r.month}, {formatCurrency(r.newAmount)}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">Nenhum reajuste registrado</span>
                )}
              </Section>
              <Section title="Acordos">
                {agreements.length ? (
                  agreements.map((a) => (
                    <span key={a.id}>
                      Acordo em {formatMonthYear(a.to)}: vencimento de {formatDateBR(a.from).slice(0, 5)} para {formatDateBR(a.to).slice(0, 5)}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">Nenhum acordo registrado</span>
                )}
              </Section>
            </div>
          </>
        )
      )}
    </div>
  )
}
