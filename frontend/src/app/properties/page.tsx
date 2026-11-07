import Link from "next/link"
import { Plus, Search } from "lucide-react"

import { goFetch } from "@/lib/go/client"
import { buildOccupancy, type OccupancyLease } from "@/lib/property-occupancy"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PropertyFilters } from "@/components/properties/PropertyFilters"
import { PropertyFormSheet } from "@/components/properties/PropertyFormSheet"
import { PropertyKpis } from "@/components/properties/PropertyKpis"
import { PropertyTable, type PropertyRow } from "@/components/properties/PropertyTable"

type SearchParams = { q?: string; tipo?: string; novo?: string }

function matchesSearch(p: PropertyRow, q: string): boolean {
  const term = q.toLowerCase()
  return [p.name, p.address_line, p.neighborhood, p.city].some((f) => f?.toLowerCase().includes(term))
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">{children}</div>
  )
}

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, tipo, novo } = await searchParams

  // Imóveis é obrigatório; contratos só alimentam a ocupação e podem falhar sem derrubar a tela.
  const [propertiesRes, leasesRes] = await Promise.allSettled([
    goFetch<PropertyRow[]>("/api/v1/properties", {}),
    goFetch<OccupancyLease[]>("/api/v1/leases", {}),
  ])

  const sheet = <PropertyFormSheet open={novo === "1"} />

  const heading = (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-[1.2]">Imóveis</h1>
        <p className="text-sm text-muted-foreground">Seus imóveis e as unidades de cada um.</p>
      </div>
    </div>
  )

  if (propertiesRes.status === "rejected") {
    console.error("Erro ao buscar imóveis:", propertiesRes.reason)
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {heading}
        <Message>
          <p className="text-muted-foreground">Não foi possível carregar os imóveis.</p>
          <Button asChild variant="outline">
            <Link href={q ? `/properties?q=${encodeURIComponent(q)}` : "/properties"}>Tentar novamente</Link>
          </Button>
        </Message>
        {sheet}
      </div>
    )
  }

  const all = propertiesRes.value ?? []
  let leases: OccupancyLease[] | null = null
  if (leasesRes.status === "fulfilled") {
    leases = leasesRes.value ?? []
  } else {
    console.error("Erro ao buscar contratos (ocupação indisponível):", leasesRes.reason)
  }

  const occupancy = buildOccupancy(all, leases ?? [], [])
  const shown = all.filter((p) => (!tipo || p.type === tipo) && (!q || matchesSearch(p, q)))

  const newButton = (
    <Button asChild>
      <Link href="/properties?novo=1">
        <Plus aria-hidden="true" />
        Cadastrar imóvel
      </Link>
    </Button>
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 max-md:pb-20">
      {heading}

      {all.length > 0 && <PropertyKpis totals={occupancy.totals} occupancyAvailable={leases !== null} />}
      {all.length > 0 && leases === null && (
        <p role="status" className="text-sm text-muted-foreground">
          A ocupação está indisponível no momento. Tente recarregar a página.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form action="/properties" method="get" role="search" className="relative w-full max-w-80">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input name="q" defaultValue={q} placeholder="Buscar imóvel" aria-label="Buscar imóvel" className="pl-9" />
        </form>
        <PropertyFilters tipo={tipo} q={q} />
        <div className="ml-auto hidden md:block">{newButton}</div>
      </div>

      {all.length === 0 ? (
        <Message>
          <div className="text-base font-semibold">Cadastre seu primeiro imóvel</div>
          <p className="max-w-md text-sm text-muted-foreground">
            É o primeiro passo para cobrar aluguel. Leva cerca de 1 minuto.
          </p>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/properties?novo=1">Cadastrar imóvel</Link>
          </Button>
        </Message>
      ) : shown.length === 0 ? (
        <Message>
          <p className="text-muted-foreground">Nenhum imóvel encontrado.</p>
        </Message>
      ) : (
        <PropertyTable properties={shown} occupancy={leases === null ? null : occupancy} />
      )}

      {all.length > 0 && (
        <div className="fixed inset-x-0 bottom-[69px] z-20 border-t bg-background p-3 md:hidden">
          <Button asChild className="w-full">
            <Link href="/properties?novo=1">
              <Plus aria-hidden="true" />
              Cadastrar imóvel
            </Link>
          </Button>
        </div>
      )}
      {sheet}
    </div>
  )
}
