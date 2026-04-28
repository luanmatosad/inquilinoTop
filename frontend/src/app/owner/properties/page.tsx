import { Suspense } from "react"
import Link from "next/link"
import { Plus, Search, MapPin, Building2 } from "lucide-react"
import { listProperties } from "@/data/owner/properties-dal"
import { Button, Input, Card, Badge } from "@heroui/react"

interface PropertyWithUnits {
  id: string
  name: string
  type: string
  address_line?: string
  city?: string
  state?: string
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
  COMMERCIAL: 'bg-tertiary-container text-on-tertiary-container',
  SINGLE: 'bg-secondary-container text-on-secondary-container',
}

function getPropertyTypeLabel(type: string): string {
  return PROPERTY_TYPE_LABELS[type] || 'Desconhecido'
}

function getPropertyTypeBadgeClass(type: string): string {
  return PROPERTY_TYPE_BADGE_CLASS[type] || 'bg-surface text-on-surface'
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
      <div className="flex flex-col items-center justify-center h-64 border border-outline-variant rounded-xl bg-surface">
        <p className="text-on-surface-variant mb-4">Nenhum imóvel encontrado.</p>
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
            <Card.Content className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-on-surface line-clamp-1">
                  {property.name}
                </h3>
                <Badge 
                  className={getPropertyTypeBadgeClass(property.type)}
                  variant="soft" 
                  size="sm"
                >
                  {getPropertyTypeLabel(property.type)}
                </Badge>
              </div>
              
              <div className="flex items-start gap-1 text-outline mb-4">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-sm line-clamp-1">
                  {property.address_line || "Sem endereço"}
                </span>
              </div>

              <div className="flex items-center gap-1 text-on-surface-variant text-sm pt-4 border-t border-surface-variant">
                <Building2 className="w-4 h-4" />
                <span className="font-medium">
                  {property.units?.length || 0} unidade(s)
                </span>
              </div>
            </Card.Content>
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
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Meus Imóveis</h1>
          <p className="text-base text-on-surface-variant mt-1">
            Gerencie seu portfólio de propriedades.
          </p>
        </div>
        <Link href="/owner/properties/new">
          <Button className="bg-secondary-container text-on-secondary-container">
            <Plus className="w-4 h-4" />
            Novo Imóvel
          </Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
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