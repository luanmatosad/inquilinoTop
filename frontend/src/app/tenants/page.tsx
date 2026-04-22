import { goFetch } from "@/lib/go/client"
import { TenantListClient } from "@/components/tenants/TenantListClient"

interface Tenant {
  id: string
  name: string
  email?: string
  phone?: string
  document?: string
  person_type: string
  is_active: boolean
  created_at: string
}

export default async function TenantsPage() {
  let tenants: Tenant[] = []

  try {
    tenants = await goFetch<Tenant[]>("/api/v1/tenants", {})
  } catch (error) {
    console.error("Erro ao buscar inquilinos:", error)
    return <div>Erro ao carregar inquilinos. Tente recarregar a página.</div>
  }

  return (
    <div className="container py-10">
      <TenantListClient tenants={tenants || []} />
    </div>
  )
}