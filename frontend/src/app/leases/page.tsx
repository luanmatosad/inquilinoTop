import { redirect } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { cookies } from "next/headers"
import { Search, Filter, Eye, Building2, CheckCircle, Archive, AlertCircle } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getActiveTenants, getActivePropertiesWithUnits } from "./actions"
import { CreateLeaseDialog } from "@/components/leases/CreateLeaseDialog"

interface Lease {
  id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date?: string | null
  rent_amount: number
  status: "ACTIVE" | "ENDED" | "CANCELED"
}

interface Tenant {
  id: string
  name: string
  document?: string
}

interface PropertyWithUnits {
  id: string
  name: string
  units: { id: string; label: string }[]
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Ativo", variant: "default" },
  ENDED: { label: "Encerrado", variant: "secondary" },
  CANCELED: { label: "Cancelado", variant: "destructive" },
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

// Datas do backend são DATE (meia-noite UTC): formatar em UTC evita voltar um dia no fuso do Brasil.
const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })

async function LeasesList({
  search,
  status,
  tenants,
  properties,
}: {
  search?: string
  status?: string
  tenants: Tenant[]
  properties: PropertyWithUnits[]
}) {
  let leases: Lease[]
  try {
    leases = (await goFetch<Lease[]>("/api/v1/leases", {})) ?? []
  } catch (error) {
    console.error("Erro ao buscar contratos:", error)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground">Não foi possível carregar os contratos.</p>
        <Link href="/leases">
          <Button variant="outline">Tentar novamente</Button>
        </Link>
      </div>
    )
  }

  const unitLabel = new Map<string, string>()
  for (const p of properties) for (const u of p.units ?? []) unitLabel.set(u.id, `${p.name} - ${u.label}`)
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]))

  const total = leases.length
  const active = leases.filter((l) => l.status === "ACTIVE").length
  const ended = leases.filter((l) => l.status === "ENDED").length
  const expiringSoon = leases.filter((l) => {
    if (!l.end_date || l.status !== "ACTIVE") return false
    const endDate = new Date(l.end_date)
    const limit = new Date()
    limit.setDate(limit.getDate() + 30)
    return endDate <= limit && endDate > new Date()
  }).length

  let filtered = leases
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (l) => (unitLabel.get(l.unit_id) ?? "").toLowerCase().includes(q) || (tenantName.get(l.tenant_id) ?? "").toLowerCase().includes(q)
    )
  }
  if (status && status !== "ALL") {
    filtered = filtered.filter((l) => l.status === status)
  }

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground">Nenhum contrato encontrado.</p>
        <CreateLeaseDialog tenants={tenants} properties={properties} />
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3 mb-2"><Building2 className="w-5 h-5 text-primary" /><span className="text-sm text-muted-foreground">Total</span></div><div className="text-2xl font-bold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3 mb-2"><CheckCircle className="w-5 h-5 text-green-600" /><span className="text-sm text-muted-foreground">Ativos</span></div><div className="text-2xl font-bold">{active}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3 mb-2"><Archive className="w-5 h-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">Encerrados</span></div><div className="text-2xl font-bold">{ended}</div></CardContent></Card>
        <Card className="border-l-4 border-l-error"><CardContent className="p-4"><div className="flex items-center gap-3 mb-2"><AlertCircle className="w-5 h-5 text-red-600" /><span className="text-sm text-muted-foreground">Vencendo em 30 dias</span></div><div className="text-2xl font-bold">{expiringSoon}</div></CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead>Inquilino</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((lease) => (
              <TableRow key={lease.id}>
                <TableCell className="font-medium">{unitLabel.get(lease.unit_id) ?? "—"}</TableCell>
                <TableCell>{tenantName.get(lease.tenant_id) ?? "—"}</TableCell>
                <TableCell className="font-mono text-sm">{formatDate(lease.start_date)}</TableCell>
                <TableCell className="font-mono text-sm">{lease.end_date ? formatDate(lease.end_date) : "—"}</TableCell>
                <TableCell className="text-right font-bold text-primary">{formatCurrency(lease.rent_amount)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={STATUS_LABELS[lease.status]?.variant ?? "secondary"}>
                    {STATUS_LABELS[lease.status]?.label ?? lease.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="icon" className="w-8 h-8" asChild>
                    <Link href={`/leases/${lease.id}`} aria-label="Ver contrato">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

export default async function LeasesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const cookieStore = await cookies()
  if (!cookieStore.get("access_token")?.value) {
    redirect("/login")
  }

  const { q, status } = await searchParams
  const tenants = await getActiveTenants()
  const properties = await getActivePropertiesWithUnits()

  return (
    <div className="container py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">Gerencie contratos de locação</p>
        </div>
        <CreateLeaseDialog tenants={tenants} properties={properties} />
      </div>

      <Card className="p-4">
        <form action="/leases" method="GET" className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input name="q" placeholder="Buscar por unidade ou inquilino..." defaultValue={q} className="pl-10" />
          </div>
          <select
            name="status"
            defaultValue={status || "ALL"}
            aria-label="Filtrar por status"
            className="h-10 px-4 rounded-md border border-input bg-background text-sm"
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="ENDED">Encerrado</option>
            <option value="CANCELED">Cancelado</option>
          </select>
          <Button type="submit" variant="outline" aria-label="Filtrar">
            <Filter className="w-4 h-4" />
          </Button>
        </form>
      </Card>

      <Suspense fallback={<div className="text-center py-10">Carregando...</div>}>
        <LeasesList search={q} status={status} tenants={tenants} properties={properties} />
      </Suspense>
    </div>
  )
}
