import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, Phone, FileText, MapPin } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { maskCep, maskCpfCnpj, maskPhone } from "@/lib/masks"

interface Tenant {
  id: string
  name: string
  person_type: "PF" | "PJ"
  email?: string
  phone?: string
  document?: string
  postal_code?: string
  address_line?: string
  city?: string
  state?: string
  notes?: string
  is_active: boolean
}

interface Lease {
  id: string
  tenant_id: string
  unit_id: string
  start_date: string
  end_date?: string | null
  status: "ACTIVE" | "ENDED" | "CANCELED"
  rent_amount: number
}

const LEASE_STATUS: Record<Lease["status"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Ativo", variant: "default" },
  ENDED: { label: "Encerrado", variant: "secondary" },
  CANCELED: { label: "Cancelado", variant: "destructive" },
}

async function TenantDetails({ id }: { id: string }) {
  let tenant: Tenant
  try {
    tenant = await goFetch<Tenant>("/api/v1/tenants/" + id, {})
  } catch (error) {
    console.error("Erro ao buscar inquilino:", error)
    notFound()
  }
  if (!tenant) notFound()

  // O backend não embute contratos no inquilino; filtra a listagem de contratos.
  let leases: Lease[] = []
  let leasesFailed = false
  try {
    const all = (await goFetch<Lease[]>("/api/v1/leases", {})) ?? []
    leases = all.filter((l) => l.tenant_id === id)
  } catch (error) {
    console.error("Erro ao buscar contratos do inquilino:", error)
    leasesFailed = true
  }

  const address = [
    tenant.address_line,
    [tenant.city, tenant.state].filter(Boolean).join("/"),
    tenant.postal_code ? `CEP ${maskCep(tenant.postal_code)}` : undefined,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          {tenant.name}
          <Badge variant="outline">{tenant.person_type === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}</Badge>
        </h1>

        <div className="mt-4 space-y-2 text-muted-foreground">
          {tenant.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>{tenant.email}</span>
            </div>
          )}
          {tenant.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{maskPhone(tenant.phone)}</span>
            </div>
          )}
          {tenant.document && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>{maskCpfCnpj(tenant.document)}</span>
            </div>
          )}
          {address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{address}</span>
            </div>
          )}
        </div>
        {tenant.notes && <p className="mt-4 text-sm whitespace-pre-line">{tenant.notes}</p>}
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Contratos ({leases.length})</h2>
        {leasesFailed ? (
          <p className="text-muted-foreground">Não foi possível carregar os contratos.</p>
        ) : leases.length === 0 ? (
          <p className="text-muted-foreground">Nenhum contrato vinculado.</p>
        ) : (
          <div className="space-y-3">
            {leases.map((lease) => (
              <div key={lease.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <span className="font-medium">Contrato {lease.id.slice(0, 8)}</span>
                  <div className="text-sm text-muted-foreground">
                    Início: {new Date(lease.start_date).toLocaleDateString("pt-BR")}
                    {lease.end_date && ` - Fim: ${new Date(lease.end_date).toLocaleDateString("pt-BR")}`}
                  </div>
                  <div className="text-sm">
                    Valor: R$ {Number(lease.rent_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <Badge variant={LEASE_STATUS[lease.status]?.variant ?? "secondary"}>
                  {LEASE_STATUS[lease.status]?.label ?? lease.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="container py-8 space-y-8">
      <div>
        <Link href="/tenants" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para lista
        </Link>
      </div>

      <Suspense fallback={<div>Carregando detalhes...</div>}>
        <TenantDetails id={id} />
      </Suspense>
    </div>
  )
}
