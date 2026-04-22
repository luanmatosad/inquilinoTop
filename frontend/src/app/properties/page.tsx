import { Suspense } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { goFetch } from "@/lib/go/client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

async function PropertiesList({ search }: { search?: string }) {
  let properties: PropertyWithUnits[] = []

  try {
    properties = await goFetch<PropertyWithUnits[]>("/api/v1/properties", {})
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
      <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-muted/10">
        <p className="text-muted-foreground mb-4">Nenhum imóvel encontrado.</p>
        <Link href="/properties/new">
          <Button>Criar Primeiro Imóvel</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <Link key={property.id} href={`/properties/${property.id}`} className="block h-full">
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="line-clamp-1">{property.name}</CardTitle>
                <Badge variant={property.type === "RESIDENTIAL" ? "default" : "secondary"}>
                  {property.type === "RESIDENTIAL" ? "Residencial" : "Único"}
                </Badge>
              </div>
              <CardDescription className="line-clamp-1">
                {property.address_line || "Sem endereço"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {property.city ? `${property.city}/${property.state}` : "Localização não informada"}
              </p>
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
              {property.units?.length || 0} unidade(s)
            </CardFooter>
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Meus Imóveis</h1>
        <Link href="/properties/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Novo Imóvel
          </Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <form action="/properties" method="GET">
            <Input
              name="q"
              placeholder="Buscar por nome..."
              className="pl-8"
              defaultValue={query}
            />
          </form>
        </div>
      </div>

      <Suspense fallback={<div className="text-center py-10">Carregando imóveis...</div>}>
        <PropertiesList search={query} />
      </Suspense>
    </div>
  )
}