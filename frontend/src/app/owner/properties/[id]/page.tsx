import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil, Building, MapPin, Trash } from "lucide-react"
import { getProperty } from "@/data/owner/properties-dal"
import type { PropertyWithUnits } from "@/data/owner/properties-dal"
import { Button } from "@heroui/react"
import { Card } from "@heroui/react"
import { Badge } from "@heroui/react"

async function PropertyDetails({ id }: { id: string }) {
  let property: PropertyWithUnits | null = null

  try {
    property = await getProperty(id)
  } catch (error) {
    console.error("Erro ao buscar propriedade:", error)
  }

  if (!property) {
    notFound()
    return null
  }

  const units = (property.units || []).sort((a, b) => 
    a.label.localeCompare(b.label, undefined, { numeric: true })
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {property.name}
            {!property.is_active && (
              <Badge color="danger" variant="secondary">Desativado</Badge>
            )}
          </h1>
          <div className="mt-2 text-on-surface-variant flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>
              {property.address_line 
                ? `${property.address_line}, ${property.city}/${property.state}`
                : "Endereço não informado"}
            </span>
          </div>
          <div className="mt-1 text-on-surface-variant flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span>
              Tipo: {property.type === "RESIDENTIAL" ? "Residencial" : "Único"}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/owner/properties/${id}/edit`}>
            <Button variant="secondary">
              <Pencil className="w-4 h-4" /> Editar Imóvel
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Unidades ({units.length})</h2>
        {units.length === 0 ? (
          <p className="text-on-surface-variant">Nenhuma unidade cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {units.map((unit) => (
              <div key={unit.id} className="flex items-center justify-between p-3 bg-surface-variant rounded-lg">
                <div>
                  <span className="font-medium">{unit.label}</span>
                  {unit.floor && <span className="text-on-surface-variant ml-2">- {unit.floor}</span>}
                </div>
                <Badge color={unit.is_active ? "success" : "default"} variant="secondary">
                  {unit.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default async function OwnerPropertyPage({ 
  params,
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="container py-8 space-y-8">
      <div>
        <Link href="/owner/properties" className="text-on-surface-variant hover:text-on-surface flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para lista
        </Link>
      </div>

      <Suspense fallback={<div>Carregando detalhes...</div>}>
        <PropertyDetails id={id} />
      </Suspense>
    </div>
  )
}