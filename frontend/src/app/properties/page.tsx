import { Suspense } from "react"
import Link from "next/link"
import { Plus, Search, MapPin, Building2 } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PropertyWithUnits {
  id: string
  name: string
  type: string
  address_line?: string
  neighborhood?: string
  city?: string
  state?: string
  postal_code?: string
  is_active: boolean
  created_at: string
  units: { id: string }[]
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  RESIDENTIAL: 'Residencial',
  COMMERCIAL: 'Comercial',
  SINGLE: 'Único',
}

const PROPERTY_TYPE_BADGE_CLASS: Record<string, string> = {
  RESIDENTIAL: 'bg-primary/10 text-primary',
  COMMERCIAL: 'bg-accent text-accent-foreground',
  SINGLE: 'bg-secondary text-secondary-foreground',
}

function getPropertyTypeLabel(type: string): string {
  return PROPERTY_TYPE_LABELS[type] || 'Desconhecido'
}

function getPropertyTypeBadgeClass(type: string): string {
  return PROPERTY_TYPE_BADGE_CLASS[type] || 'bg-muted text-foreground'
}

function formatAddress(p: PropertyWithUnits): string {
  const cityState = [p.city, p.state].filter(Boolean).join("/")
  return [p.address_line, p.neighborhood, cityState].filter(Boolean).join(", ")
}

async function PropertiesList({ search }: { search?: string }) {
  let properties: PropertyWithUnits[] = []

  try {
    properties = await goFetch<PropertyWithUnits[]>("/api/v1/properties", {})
  } catch (error) {
    console.error("Erro ao buscar propriedades:", error)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground">Não foi possível carregar os imóveis.</p>
        <Link href={search ? `/properties?q=${encodeURIComponent(search)}` : "/properties"}>
          <Button variant="outline">Tentar novamente</Button>
        </Link>
      </div>
    )
  }

  if (search) {
    const q = search.toLowerCase()
    properties = (properties ?? []).filter(p =>
      [p.name, p.address_line, p.neighborhood, p.city].some(f => f?.toLowerCase().includes(q))
    )
  }

  if (!properties || properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground mb-4">Nenhum imóvel encontrado.</p>
        <Link href="/properties/new">
          <Button>Criar Primeiro Imóvel</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((property) => (
        <Link key={property.id} href={`/properties/${property.id}`} className="block h-full">
          <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                  {property.name}
                </h3>
                <Badge className={getPropertyTypeBadgeClass(property.type)}>
                  {getPropertyTypeLabel(property.type)}
                </Badge>
              </div>
              
              <div className="flex items-start gap-1 text-muted-foreground mb-4">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-sm line-clamp-1">
                  {formatAddress(property) || "Sem endereço"}
                </span>
              </div>

              <div className="flex items-center gap-1 text-muted-foreground text-sm pt-4 border-t border-border">
                <Building2 className="w-4 h-4" />
                <span className="font-medium">
                  {property.units?.length || 0} unidade(s)
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const query = params.q

  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus Imóveis</h1>
          <p className="text-base text-muted-foreground mt-1">
            Gerencie seu portfólio de propriedades.
          </p>
        </div>
        <Link href="/properties/new">
          <Button variant="secondary">
            <Plus className="w-4 h-4" />
            Novo Imóvel
          </Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <form action="/properties" method="GET" className="relative">
              <Input
                name="q"
                placeholder="Buscar por nome, endereço ou cidade..."
                defaultValue={query}
                className="pl-10"
              />
            </form>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <span className="hidden sm:inline">Filtros</span>
            </Button>
            <Button variant="outline">
              <span className="hidden sm:inline">Ordenar</span>
            </Button>
          </div>
        </div>
      </Card>

      <Suspense fallback={<div className="text-center py-10">Carregando imóveis...</div>}>
        <PropertiesList search={query} />
      </Suspense>
    </div>
  )
}