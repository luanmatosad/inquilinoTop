import Link from "next/link"
import { notFound } from "next/navigation"

import { goFetch } from "@/lib/go/client"
import { buildOccupancy, type OccupancyLease, type OccupancyTenant } from "@/lib/property-occupancy"
import { formatPropertyAddress, propertyTypeLabel } from "@/lib/property-format"
import { unitToFormValues } from "@/lib/unit-form"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DeletePropertyButton } from "@/components/properties/DeletePropertyButton"
import { PropertyForm } from "@/components/properties/PropertyForm"
import { UnitFormSheet } from "@/components/properties/UnitFormSheet"
import { UnitTable, type Unit } from "@/components/properties/UnitTable"
import type { PropertyFormValues } from "@/lib/schemas"

interface PropertyDetail {
  id: string
  name: string
  type: "RESIDENTIAL" | "COMMERCIAL" | "SINGLE"
  address_line?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  postal_code?: string
  is_active: boolean
  units?: Unit[]
}

type SearchParams = { aba?: string; unidade?: string }

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const { id } = await params
  const { aba, unidade } = await searchParams
  const tab = aba === "informacoes" ? "informacoes" : "unidades"

  let property: PropertyDetail | undefined
  try {
    property = await goFetch<PropertyDetail>("/api/v1/properties/" + id, {})
  } catch (error) {
    console.error("Erro ao buscar imóvel:", error)
  }
  if (!property) notFound()

  const units = [...(property.units ?? [])].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  )

  // Ocupação só importa na aba Unidades. Contratos fora do ar degradam para "—"; sem inquilinos, só falta o nome.
  let occupancy = null
  if (tab === "unidades") {
    const [leases, tenants] = await Promise.allSettled([
      goFetch<OccupancyLease[]>("/api/v1/leases", {}),
      goFetch<OccupancyTenant[]>("/api/v1/tenants", {}),
    ])
    if (leases.status === "fulfilled") {
      const t = tenants.status === "fulfilled" ? (tenants.value ?? []) : []
      occupancy = buildOccupancy([{ id: property.id, units }], leases.value ?? [], t).byUnit
    } else {
      console.error("Erro ao buscar contratos (ocupação indisponível):", leases.reason)
    }
  }

  const editing = unidade && unidade !== "nova" ? units.find((u) => u.id === unidade) : undefined
  const sheetOpen = unidade === "nova" || !!editing

  const formValues = {
    id: property.id,
    name: property.name,
    type: property.type,
    address_line: property.address_line,
    number: property.number,
    complement: property.complement,
    neighborhood: property.neighborhood,
    city: property.city,
    state: property.state,
    postal_code: property.postal_code,
  } as PropertyFormValues & { id: string }

  const unitCount = units.length
  const subtitle = [
    formatPropertyAddress(property) || "Endereço não informado",
    propertyTypeLabel(property.type),
    `${unitCount} ${unitCount === 1 ? "unidade" : "unidades"}`,
  ].join(" · ")

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-1">
          <nav aria-label="Navegação" className="text-sm text-muted-foreground">
            <Link href="/properties" className="hover:underline">
              Imóveis
            </Link>{" "}
            › Detalhes
          </nav>
          <h1 className="flex items-center gap-2 text-2xl font-semibold leading-[1.2]">
            {property.name}
            {!property.is_active && <Badge variant="destructive">Desativado</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="ml-auto">
          <DeletePropertyButton id={property.id} name={property.name} />
        </div>
      </div>

      <Tabs value={tab}>
        <TabsList variant="line">
          <TabsTrigger value="unidades" asChild>
            <Link href={`/properties/${id}`}>Unidades</Link>
          </TabsTrigger>
          <TabsTrigger value="informacoes" asChild>
            <Link href={`/properties/${id}?aba=informacoes`}>Informações</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unidades" className="pt-4">
          {tab === "unidades" && <UnitTable propertyId={property.id} units={units} occupancy={occupancy} />}
        </TabsContent>
        <TabsContent value="informacoes" className="pt-4">
          {tab === "informacoes" && (
            <Card className="max-w-xl p-6">
              <PropertyForm initialData={formValues} />
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <UnitFormSheet
        propertyId={property.id}
        propertyName={property.name}
        unit={editing ? unitToFormValues(editing) : undefined}
        open={sheetOpen}
      />
    </div>
  )
}
