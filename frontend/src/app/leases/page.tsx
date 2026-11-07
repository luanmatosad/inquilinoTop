import Link from "next/link"
import { Plus, Search } from "lucide-react"

import { goFetch } from "@/lib/go/client"
import { formatCurrency } from "@/lib/utils"
import { formatDateBR, formatMonthYear } from "@/lib/date-format"
import {
  buildLeaseIndicators,
  buildLeaseRows,
  isReadjustSoon,
  isReadjustmentPending,
  type OverviewLeaseItem,
} from "@/lib/lease-overview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LeaseFilters } from "@/components/leases/LeaseFilters"
import { LeaseFormSheet } from "@/components/leases/LeaseFormSheet"
import { LeaseKpis } from "@/components/leases/LeaseKpis"
import { LeaseTable, type LeaseTableRow } from "@/components/leases/LeaseTable"
import { plural } from "@/lib/property-format"

type ApiTenant = { id: string; name: string }
type ApiProperty = {
  id: string
  name: string
  units?: { id: string; label: string; reference_rent?: number | null }[] | null
}
type SearchParams = { q?: string; situacao?: string; novo?: string; inquilino?: string; unidade?: string }

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ativo", ENDED: "Encerrado", CANCELED: "Cancelado" }

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">{children}</div>
}

export default async function LeasesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, situacao, novo, inquilino, unidade } = await searchParams

  // Contratos é obrigatório; inquilinos e imóveis só enriquecem a lista.
  const [leasesRes, tenantsRes, propertiesRes] = await Promise.allSettled([
    goFetch<OverviewLeaseItem[]>("/api/v1/leases", {}),
    goFetch<ApiTenant[]>("/api/v1/tenants", {}),
    goFetch<ApiProperty[]>("/api/v1/properties", {}),
  ])

  const heading = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold leading-[1.2]">Contratos</h1>
      <p className="text-sm text-muted-foreground">Quem aluga o quê, por quanto e até quando.</p>
    </div>
  )

  if (leasesRes.status === "rejected") {
    console.error("Erro ao buscar contratos:", leasesRes.reason)
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {heading}
        <Message>
          <p className="text-muted-foreground">Não foi possível carregar os contratos.</p>
          <Button asChild variant="outline">
            <Link href="/leases">Tentar novamente</Link>
          </Button>
        </Message>
      </div>
    )
  }

  const all = leasesRes.value ?? []
  const tenantsOk = tenantsRes.status === "fulfilled"
  const propertiesOk = propertiesRes.status === "fulfilled"
  if (!tenantsOk) console.error("Erro ao buscar inquilinos:", tenantsRes.reason)
  if (!propertiesOk) console.error("Erro ao buscar imóveis:", propertiesRes.reason)

  const now = new Date()
  const rowsAll = buildLeaseRows({
    leases: all,
    tenants: tenantsOk ? (tenantsRes.value ?? []) : [],
    properties: propertiesOk ? (propertiesRes.value ?? []) : [],
  })
  const kpis = buildLeaseIndicators(all, now)
  const readjustWhere = rowsAll
    .filter((r) => isReadjustSoon(r.lease, now))
    .map((r) => `${r.unitLabel} · ${r.propertyName}`)
    .join(", ")

  const term = q?.toLowerCase().trim() ?? ""
  const shown = rowsAll.filter(
    (r) =>
      (!situacao || r.lease.status === situacao) &&
      (!term || `${r.tenantName} ${r.unitLabel} ${r.propertyName}`.toLowerCase().includes(term)),
  )

  const tableRows: LeaseTableRow[] = shown.map((r) => ({
    id: r.lease.id,
    unit: r.unitLabel,
    property: r.propertyName,
    tenant: r.tenantName,
    start: formatDateBR(r.lease.start_date),
    end: r.lease.end_date ? formatDateBR(r.lease.end_date) : "Sem fim",
    rent: formatCurrency(r.lease.rent_amount),
    readjust: isReadjustmentPending(r.lease, now) ? "pendente" : formatMonthYear(r.lease.next_readjustment),
    readjustPending: isReadjustmentPending(r.lease, now),
    status: r.lease.status,
    statusLabel: STATUS_LABEL[r.lease.status] ?? r.lease.status,
  }))

  let notice: string | null = null
  if (!tenantsOk) notice = "Inquilinos indisponíveis no momento: o nome aparece como “—”."
  else if (!propertiesOk) notice = "Imóveis indisponíveis no momento: unidade e imóvel aparecem como “—”."

  const unitOptions = (propertiesOk ? (propertiesRes.value ?? []) : []).flatMap((p) =>
    (p.units ?? []).map((u) => ({ id: u.id, label: u.label, propertyName: p.name, referenceRent: u.reference_rent })),
  )
  const tenantOptions = tenantsOk ? (tenantsRes.value ?? []) : []
  const sheet = (
    <LeaseFormSheet
      open={novo === "1"}
      units={unitOptions}
      tenants={tenantOptions}
      defaultUnitId={unidade}
      defaultTenantId={inquilino}
    />
  )

  const createLink = (
    <Button asChild>
      <Link href="/leases?novo=1">
        <Plus aria-hidden="true" />
        Criar contrato
      </Link>
    </Button>
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 max-md:pb-20">
      {heading}

      {all.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground md:hidden">{plural(kpis.activeCount, "ativo", "ativos")}</p>
          <LeaseKpis k={{ ...kpis, readjustWhere }} />
          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <form action="/leases" method="get" role="search" className="relative w-full max-w-80">
              {situacao && <input type="hidden" name="situacao" value={situacao} />}
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="Buscar inquilino ou unidade" aria-label="Buscar inquilino ou unidade" className="pl-9" />
            </form>
            <LeaseFilters situacao={situacao} q={q} />
            <div className="ml-auto hidden md:block">{createLink}</div>
          </div>
        </>
      )}

      {all.length === 0 ? (
        <Message>
          <div className="text-base font-semibold">Crie seu primeiro contrato</div>
          <p className="max-w-md text-sm text-muted-foreground">
            Escolha a unidade e o inquilino, defina o aluguel e as cobranças saem sozinhas.
          </p>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/leases?novo=1">Criar contrato</Link>
          </Button>
        </Message>
      ) : shown.length === 0 ? (
        <Message>
          <p className="text-muted-foreground">Nenhum contrato encontrado.</p>
        </Message>
      ) : (
        <LeaseTable rows={tableRows} />
      )}

      {all.length > 0 && (
        <div className="fixed inset-x-0 bottom-[69px] z-20 border-t bg-background p-3 md:hidden">
          <Button asChild className="w-full">
            <Link href="/leases?novo=1">
              <Plus aria-hidden="true" />
              Criar contrato
            </Link>
          </Button>
        </div>
      )}
      {sheet}
    </div>
  )
}
