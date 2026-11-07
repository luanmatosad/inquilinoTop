import Link from "next/link"
import { Plus, Search, Upload } from "lucide-react"

import { goFetch } from "@/lib/go/client"
import { maskDocumentPartial, maskPhone, onlyDigits } from "@/lib/masks"
import {
  buildTenantOverview,
  currentMonthRange,
  type OverviewLease,
  type OverviewPayment,
  type OverviewProperty,
} from "@/lib/tenant-overview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TenantFilters } from "@/components/tenants/TenantFilters"
import { TenantFormSheet } from "@/components/tenants/TenantFormSheet"
import { TenantTable, type TenantRow } from "@/components/tenants/TenantTable"
import { plural } from "@/lib/property-format"

type ApiTenant = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  document?: string | null
}

type SearchParams = { q?: string; cobranca?: string; novo?: string }

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">{children}</div>
}

export default async function TenantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, cobranca, novo } = await searchParams
  const { from, to } = currentMonthRange()

  // Inquilinos é obrigatório; o resto só enriquece a lista e pode falhar sem derrubar a tela.
  const [tenantsRes, leasesRes, propertiesRes, monthRes, lateRes] = await Promise.allSettled([
    goFetch<ApiTenant[]>("/api/v1/tenants", {}),
    goFetch<OverviewLease[]>("/api/v1/leases", {}),
    goFetch<OverviewProperty[]>("/api/v1/properties", {}),
    goFetch<OverviewPayment[]>(`/api/v1/payments?from=${from}&to=${to}`, {}),
    goFetch<OverviewPayment[]>("/api/v1/payments?status=LATE", {}),
  ])

  const sheet = <TenantFormSheet open={novo === "1"} />
  const heading = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold leading-[1.2]">Inquilinos</h1>
      <p className="text-sm text-muted-foreground">Quem mora ou usa seus imóveis.</p>
    </div>
  )

  if (tenantsRes.status === "rejected") {
    console.error("Erro ao buscar inquilinos:", tenantsRes.reason)
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {heading}
        <Message>
          <p className="text-muted-foreground">Não foi possível carregar os inquilinos.</p>
          <Button asChild variant="outline">
            <Link href="/tenants">Tentar novamente</Link>
          </Button>
        </Message>
        {sheet}
      </div>
    )
  }

  const all = tenantsRes.value ?? []
  const leasesOk = leasesRes.status === "fulfilled"
  const propertiesOk = propertiesRes.status === "fulfilled"
  const paymentsOk = monthRes.status === "fulfilled" && lateRes.status === "fulfilled"
  for (const [name, r] of [["contratos", leasesRes], ["imóveis", propertiesRes], ["pagamentos do mês", monthRes], ["pagamentos atrasados", lateRes]] as const) {
    if (r.status === "rejected") console.error(`Erro ao buscar ${name}:`, r.reason)
  }

  const overview = buildTenantOverview({
    tenants: all,
    leases: leasesOk ? (leasesRes.value ?? []) : [],
    properties: propertiesOk ? (propertiesRes.value ?? []) : [],
    monthPayments: monthRes.status === "fulfilled" ? (monthRes.value ?? []) : [],
    latePayments: lateRes.status === "fulfilled" ? (lateRes.value ?? []) : [],
  })
  const billingAvailable = leasesOk && paymentsOk

  // A máscara é aplicada aqui, no servidor: só o texto mascarado segue para a tela.
  const rows: (TenantRow & { search: string; doc: string; status: string })[] = all.map((t) => {
    const o = overview.get(t.id)!
    let where = "—"
    if (leasesOk && propertiesOk) {
      where = !o.lease ? "Sem contrato" : o.unit && o.property ? `${o.unit.label} · ${o.property.name}` : "Contrato ativo"
    } else if (leasesOk && !o.lease) {
      where = "Sem contrato"
    }
    return {
      id: t.id,
      name: t.name,
      contact: [t.email, maskPhone(t.phone)].filter(Boolean).join(" · "),
      document: maskDocumentPartial(t.document),
      where,
      billing: billingAvailable ? o.billing : "UNAVAILABLE",
      search: `${t.name} ${t.email ?? ""}`.toLowerCase(),
      doc: onlyDigits(t.document),
      status: leasesOk ? (o.billing ?? "") : "",
    }
  })

  const term = q?.toLowerCase().trim() ?? ""
  const digits = onlyDigits(q)
  const shown = rows.filter(
    (r) =>
      (!cobranca || r.status === cobranca) &&
      (!term || r.search.includes(term) || (digits.length > 0 && r.doc.includes(digits))),
  )

  let notice: string | null = null
  if (!leasesOk) notice = "Contratos indisponíveis no momento: imóvel e cobrança aparecem como “—”."
  else if (!propertiesOk) notice = "Imóveis indisponíveis no momento: a unidade aparece como “—”."
  else if (!paymentsOk) notice = "A cobrança do mês está indisponível no momento."

  const newButton = (
    <Button asChild>
      <Link href="/tenants?novo=1">
        <Plus aria-hidden="true" />
        Cadastrar inquilino
      </Link>
    </Button>
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 max-md:pb-20">
      {heading}

      {all.length > 0 && (
        <p className="text-sm text-muted-foreground md:hidden">{plural(all.length, "inquilino", "inquilinos")}</p>
      )}
      {all.length > 0 && notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form action="/tenants" method="get" role="search" className="relative w-full max-w-80">
          {cobranca && <input type="hidden" name="cobranca" value={cobranca} />}
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input name="q" defaultValue={q} placeholder="Buscar inquilino" aria-label="Buscar inquilino" className="pl-9" />
        </form>
        <TenantFilters cobranca={cobranca} q={q} />
        <div className="ml-auto hidden gap-2 md:flex">
          <Button asChild variant="outline">
            <Link href="/import">
              <Upload aria-hidden="true" />
              Importar
            </Link>
          </Button>
          {newButton}
        </div>
      </div>

      {all.length === 0 ? (
        <Message>
          <div className="text-base font-semibold">Cadastre seu primeiro inquilino</div>
          <p className="max-w-md text-sm text-muted-foreground">
            Para começar, só precisa de nome e contato. O contrato vem depois.
          </p>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/tenants?novo=1">Cadastrar inquilino</Link>
          </Button>
        </Message>
      ) : shown.length === 0 ? (
        <Message>
          <p className="text-muted-foreground">Nenhum inquilino encontrado.</p>
        </Message>
      ) : (
        // Só os campos de exibição seguem: `doc` (documento completo, usado na busca) fica no servidor.
        <TenantTable rows={shown.map(({ id, name, contact, document, where, billing }) => ({ id, name, contact, document, where, billing }))} />
      )}

      {all.length > 0 && (
        <div className="fixed inset-x-0 bottom-[69px] z-20 border-t bg-background p-3 md:hidden">
          <Button asChild className="w-full">
            <Link href="/tenants?novo=1">
              <Plus aria-hidden="true" />
              Cadastrar inquilino
            </Link>
          </Button>
        </div>
      )}
      {sheet}
    </div>
  )
}
