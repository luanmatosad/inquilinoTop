import { PropertyForm } from "@/components/properties/PropertyForm"

export default function NewPropertyPage() {
  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Novo Imóvel</h1>
        <p className="text-muted-foreground">Preencha os dados abaixo para cadastrar um novo imóvel.</p>
      </div>
      <PropertyForm />
    </div>
  )
}
