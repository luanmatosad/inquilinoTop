import { Suspense } from "react"
import Link from "next/link"
import { listTenants } from "@/data/owner/tenants-dal"
import { Card, Badge } from "@heroui/react"
import { User, Mail, Phone } from "lucide-react"

interface Tenant {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  is_active: boolean
  created_at: string
}

async function TenantsList() {
  let tenants: Tenant[] = []

  try {
    tenants = await listTenants()
  } catch (error) {
    console.error("Erro ao buscar inquilinos:", error)
  }

  if (!tenants || tenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-outline-variant rounded-xl bg-surface">
        <p className="text-on-surface-variant mb-4">Nenhum inquilino encontrado.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tenants.map((tenant) => (
        <Link key={tenant.id} href={`/owner/tenants/${tenant.id}`} className="block h-full">
          <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-on-surface line-clamp-1">
                  {tenant.name}
                </h3>
                <Badge color={tenant.is_active ? "success" : "default"} variant="secondary">
                  {tenant.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm text-on-surface-variant">
                {tenant.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span className="line-clamp-1">{tenant.email}</span>
                  </div>
                )}
                {tenant.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{tenant.phone}</span>
                  </div>
                )}
                {tenant.document && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{tenant.document}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}

export default async function OwnerTenantsPage() {
  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Meus Inquilinos</h1>
          <p className="text-base text-on-surface-variant mt-1">
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