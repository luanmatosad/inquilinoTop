import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getProfile } from '@/app/settings/profile/actions'
import { GettingStarted } from '@/components/today/GettingStarted'
import { TodayKpis } from '@/components/today/TodayKpis'
import { TodayLists } from '@/components/today/TodayLists'
import { Button } from '@/components/ui/button'
import { monthRange, parseMonth, type OverviewPayment } from '@/lib/financial-overview'
import { goFetch } from '@/lib/go/client'
import { noticeDaysOf, type FinancialRules } from '@/lib/financial-rules'
import { MONTHS } from '@/lib/date-format'
import { SESSION_EXPIRED_LOGIN_URL } from '@/lib/session'
import { buildChecklist, buildToday, dateLabel, greeting, headline, type TodayLease } from '@/lib/today-overview'

type ApiTenant = { id: string; name: string }
type ApiProperty = { id: string; name: string; units?: { id: string; label: string }[] | null }

const Shell = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">{children}</div>

/** Hoje: o que confirmar, cobrar e resolver. As buscas são as de Recebimentos mais contratos, config e perfil. */
export default async function TodayPage() {
  const now = new Date()
  const ym = parseMonth(undefined, now)
  const { from, to } = monthRange(ym)

  // Cobranças são obrigatórias; o resto só enriquece (ou alimenta os primeiros passos) e degrada.
  const [monthRes, lateRes, leasesRes, tenantsRes, propertiesRes, configRes, profile, rulesRes, pixRes] = await Promise.allSettled([
    goFetch<OverviewPayment[]>(`/api/v1/payments?from=${from}&to=${to}`, {}),
    goFetch<OverviewPayment[]>('/api/v1/payments?status=LATE', {}),
    goFetch<TodayLease[]>('/api/v1/leases', {}),
    goFetch<ApiTenant[]>('/api/v1/tenants', {}),
    goFetch<ApiProperty[]>('/api/v1/properties', {}),
    goFetch<{ pix_key?: string | null }>('/api/v1/payments/config', {}),
    getProfile(),
    goFetch<FinancialRules>('/api/v1/settings/financial-rules', {}),
    goFetch<{ default?: { configured?: boolean } }>('/api/v1/settings/pix', {}),
  ])

  const failed = monthRes.status === 'rejected' ? monthRes : lateRes.status === 'rejected' ? lateRes : null
  if (failed) {
    const reason = failed.reason
    if (reason instanceof Error && reason.message === 'UNAUTHORIZED') redirect(SESSION_EXPIRED_LOGIN_URL)
    console.error('Erro ao buscar o painel:', reason)
    return (
      <Shell>
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">
          <p className="text-muted-foreground">Não foi possível carregar o painel de hoje.</p>
          <Button asChild variant="outline">
            <Link href="/">Tentar novamente</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  const optional = [['contratos', leasesRes], ['inquilinos', tenantsRes], ['imóveis', propertiesRes]] as const
  for (const [name, r] of optional) if (r.status === 'rejected') console.error(`Erro ao buscar ${name}:`, r.reason)
  const missing = optional.filter(([, r]) => r.status === 'rejected').map(([n]) => n)

  const leases = leasesRes.status === 'fulfilled' ? (leasesRes.value ?? []) : []
  const tenants = tenantsRes.status === 'fulfilled' ? (tenantsRes.value ?? []) : []
  const properties = propertiesRes.status === 'fulfilled' ? (propertiesRes.value ?? []) : []

  const today = buildToday({
    payments: [...(monthRes.status === 'fulfilled' ? (monthRes.value ?? []) : []), ...(lateRes.status === 'fulfilled' ? (lateRes.value ?? []) : [])],
    leases,
    tenants,
    properties,
    readjustNoticeDays: noticeDaysOf(rulesRes.status === 'fulfilled' ? rulesRes.value : null),
    now,
  })

  // Conta nova = nenhum contrato; se a busca de contratos falhou, não dá para afirmar.
  const isNewAccount = leasesRes.status === 'fulfilled' && leases.length === 0
  // Pix configurado: na tela nova (Configurações > Recebimento) ou na chave antiga.
  const hasPix =
    (pixRes.status === 'fulfilled' && !!pixRes.value?.default?.configured) || (configRes.status === 'fulfilled' && !!configRes.value?.pix_key?.trim())
  const firstName = profile.status === 'fulfilled' ? profile.value?.full_name?.trim().split(/\s+/)[0] : undefined
  const monthName = MONTHS[Number(ym.slice(5, 7)) - 1].toLowerCase()

  return (
    <Shell>
      <header className="flex flex-col gap-1.5">
        <p className="text-sm text-muted-foreground">{dateLabel(now)}</p>
        <h1 className="text-2xl font-semibold leading-[1.2]">{firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}</h1>
        <p className="text-base">
          {isNewAccount ? 'Seu painel ganha vida assim que você cadastrar o primeiro contrato.' : headline(today.count)}
        </p>
      </header>

      {missing.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Dados indisponíveis no momento ({missing.join(', ')}): alguns campos aparecem como “—”.
        </p>
      )}

      <TodayKpis kpis={today.kpis} monthLabel={monthName} />

      {isNewAccount ? (
        <GettingStarted checklist={buildChecklist({ properties: properties.length, tenants: tenants.length, leases: leases.length, hasPix })} />
      ) : (
        <TodayLists confirm={today.confirm} late={today.late} collect={today.collect} watch={today.watch} />
      )}
    </Shell>
  )
}
