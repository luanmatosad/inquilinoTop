import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Pencil, Building, MapPin } from "lucide-react"
import { createClient } from '@/lib/supabase/server'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UnitList, type Unit } from "@/components/properties/UnitList"
import { Badge } from "@/components/ui/badge"

import { DeletePropertyButton } from "@/components/properties/DeletePropertyButton"

async function PropertyDetails({ id, addUnit }: { id: string, addUnit: boolean }) {
  const supabase = await createClient()

  // Busca a propriedade e suas unidades
  const { data: property, error } = await supabase
    .from("properties")
    .select(`
      *,
      units (*)
    `)
    .eq("id", id)
    .single()

  if (error || !property) {
    if (error?.code === "PGRST116") { // Não encontrado
      notFound()
    }
    throw error
  }

  // Ordena as unidades por label
  const units = ((property.units as unknown as Unit[]) || []).sort((a, b) => 
    a.label.localeCompare(b.label, undefined, { numeric: true })
  )

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {property.name}
            {!property.is_active && (
              <Badge variant="destructive">Desativado</Badge>
            )}
          </h1>
          <div className="mt-2 text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>
              {property.address_line 
                ? `${property.address_line}, ${property.city}/${property.state}`
                : "Endereço não informado"}
            </span>
          </div>
          <div className="mt-1 text-muted-foreground flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span>
              Tipo: {property.type === "RESIDENTIAL" ? "Residencial" : "Único"}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/properties/${id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" /> Editar Imóvel
            </Button>
          </Link>
          <DeletePropertyButton id={property.id} name={property.name} />
        </div>
      </div>

      {/* Lista de Unidades */}
      <Card>
        <CardHeader>
          <CardTitle>Unidades ({units.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <UnitList 
            propertyId={property.id} 
            units={units} 
            defaultOpenAdd={addUnit} 
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default async function PropertyPage({ 
  params,
  searchParams,
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ addUnit?: string }>
}) {
  const { id } = await params
  const { addUnit } = await searchParams

  return (
    <div className="container py-8 space-y-8">
      <div>
        <Link href="/properties" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para lista
        </Link>
      </div>

      <Suspense fallback={<div>Carregando detalhes...</div>}>
        <PropertyDetails id={id} addUnit={addUnit === "true"} />
      </Suspense>
    </div>
  )
}
