import { notFound } from "next/navigation"
import { createClient } from '@/lib/supabase/server'
import { PropertyForm } from "@/components/properties/PropertyForm"

async function EditPropertyFormWrapper({ id }: { id: string }) {
  const supabase = await createClient()

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !property) {
    if (error?.code === "PGRST116") {
      notFound()
    }
    throw error
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
