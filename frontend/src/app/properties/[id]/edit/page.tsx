import { notFound } from "next/navigation"
import { goFetch } from "@/lib/go/client"
import { PropertyForm } from "@/components/properties/PropertyForm"
import { Property } from "../actions"

async function EditPropertyFormWrapper({ id }: { id: string }) {
  let property

  try {
    property = await goFetch<Property>("/api/v1/properties/" + id, {})
  } catch {
    notFound()
  }

  if (!property) {
    notFound()
  }

  return <PropertyForm initialData={property} />
}

export default async function EditPropertyPage({ 
  params,
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Editar Imóvel</h1>
        <p className="text-muted-foreground">Atualize as informações do imóvel.</p>
      </div>
      <EditPropertyFormWrapper id={id} />
    </div>
  )
}