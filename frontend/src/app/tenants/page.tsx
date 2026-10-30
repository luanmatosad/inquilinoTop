import Link from "next/link"
import { goFetch } from "@/lib/go/client"
import { Button } from "@/components/ui/button"
import { TenantListClient } from "@/components/tenants/TenantListClient"
import type { TenantFormData } from "@/components/tenants/TenantForm"

type Tenant = TenantFormData & { is_active: boolean; created_at: string }

export default async function TenantsPage() {
  let tenants: Tenant[]

  try {
    tenants = (await goFetch<Tenant[]>("/api/v1/tenants", {})) ?? []
  } catch (error) {
    console.error("Erro ao buscar inquilinos:", error)
    return (
      <div className="container py-10">
        <div className="flex flex-col items-center justify-center h-64 gap-3 border border-border rounded-xl bg-card">
          <p className="text-muted-foreground">Não foi possível carregar os inquilinos.</p>
          <Link href="/tenants">
            <Button variant="outline">Tentar novamente</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <TenantListClient tenants={tenants} />
    </div>
  )
}
