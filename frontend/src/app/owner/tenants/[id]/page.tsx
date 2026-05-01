import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, Phone, FileText } from "lucide-react"
import { getTenantWithLeases } from "@/data/owner/tenants-dal"
import { Card } from "@heroui/react"
import { Badge } from "@heroui/react"

interface Lease {
  id: string
  unit_id: string
  start_date: string
  end_date: string | null
  status: string
  rent_amount: number
  payment_day: number
}

interface Tenant {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  is_active: boolean
  created_at: string
  leases: Lease[]
}

async function TenantDetails({ id }: { id: string }) {
  let tenant: Tenant | null = null

  try {
    tenant = await getTenantWithLeases(id)
  } catch (error) {
    console.error("Erro ao buscar inquilino:", error)
  }

  if (!tenant) {
    notFound()
    return null
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {tenant.name}
            <Badge color={tenant.is_active ? "success" : "default"} variant="secondary">
              {tenant.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </h1>
          
          <div className="mt-4 space-y-2 text-on-surface-variant">
            {tenant.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{tenant.email}</span>
              </div>
            )}
            {tenant.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>{tenant.phone}</span>
              </div>
            )}
            {tenant.document && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>{tenant.document}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Contratos ({tenant.leases?.length || 0})</h2>
        {(!tenant.leases || tenant.leases.length === 0) ? (
          <p className="text-on-surface-variant">Nenhum contrato vinculado.</p>
        ) : (
          <div className="space-y-3">
            {tenant.leases.map((lease) => (
              <div key={lease.id} className="flex items-center justify-between p-4 bg-surface-variant rounded-lg">
                <div>
                  <span className="font-medium">Contrato {lease.id.slice(0, 8)}</span>
                  <div className="text-sm text-on-surface-variant">
                    Início: {new Date(lease.start_date).toLocaleDateString('pt-BR')}
                    {lease.end_date && ` - Fim: ${new Date(lease.end_date).toLocaleDateString('pt-BR')}`}
                  </div>
                  <div className="text-sm">
                    Valor: R$ {Number(lease.rent_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <Badge color={
                  lease.status === 'ACTIVE' ? "success" : 
                  lease.status === 'ENDED' ? "default" : "danger"
                } variant="secondary">
                  {lease.status === 'ACTIVE' ? 'Ativo' : 
                   lease.status === 'ENDED' ? 'Encerrado' : 'Cancelado'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default async function OwnerTenantPage({ 
  params,
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="container py-8 space-y-8">
      <div>
        <Link href="/owner/tenants" className="text-on-surface-variant hover:text-on-surface flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para lista
        </Link>
      </div>

      <Suspense fallback={<div>Carregando detalhes...</div>}>
        <TenantDetails id={id} />
      </Suspense>
    </div>
  )
}