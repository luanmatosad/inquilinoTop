import Link from "next/link"
import { listTenants, type Tenant } from "@/data/owner/tenants-dal"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Mail, Phone } from "lucide-react"

export async function TenantsList() {
  let tenants: Tenant[]

  try {
    tenants = await listTenants()
  } catch (error) {
    console.error("Erro ao buscar inquilinos:", error)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground">
          Não foi possível carregar os inquilinos. Tente novamente.
        </p>
        <Link href="/owner/tenants" className="text-sm font-medium underline">
          Tentar novamente
        </Link>
      </div>
    )
  }

  if (tenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground mb-4">Nenhum inquilino encontrado.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tenants.map((tenant) => (
        <Link key={tenant.id} href={`/owner/tenants/${tenant.id}`} className="block h-full">
          <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                  {tenant.name}
                </h3>
                <Badge variant={tenant.is_active ? "default" : "secondary"}>
                  {tenant.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
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
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
