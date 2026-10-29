import { Suspense } from "react"
import { TenantsList } from "@/components/owner/TenantsList"

export default async function OwnerTenantsPage() {
  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus Inquilinos</h1>
          <p className="text-base text-muted-foreground mt-1">
            Gerencie seus inquilinos.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="text-center py-10">Carregando inquilinos...</div>}>
        <TenantsList />
      </Suspense>
    </div>
  )
}