import { Suspense } from "react"
import Link from "next/link"
import { listProperties, type PropertyWithUnits } from "@/data/owner/properties-dal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, MapPin, Building2 } from "lucide-react"

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

async function PropertiesList({ search }: { search?: string }) {
  let properties: PropertyWithUnits[] = []

  try {
    properties = await listProperties()
  } catch (error) {
    console.error("Erro ao buscar propriedades:", error)
  }

  if (search) {
    properties = properties.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase())
    )
  }

  if (!properties || properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground mb-4">Nenhum imóvel encontrado.</p>
        <Link href="/owner/properties/new">
          <Button>Criar Primeiro Imóvel</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((property) => (
        <Link key={property.id} href={`/owner/properties/${property.id}`} className="block h-full">
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
                  {property.address_line || "Sem endereço"}
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

export default async function OwnerPropertiesPage({
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
        <Link href="/owner/properties/new">
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
            <form action="/owner/properties" method="GET" className="relative">
              <Input
                name="q"
                placeholder="Buscar por nome, endereço ou cidade..."
                defaultValue={query}
                className="pl-10"
              />
            </form>
          </div>
        </div>
      </Card>

      <Suspense fallback={<div className="text-center py-10">Carregando imóveis...</div>}>
        <PropertiesList search={query} />
      </Suspense>
    </div>
  )
}