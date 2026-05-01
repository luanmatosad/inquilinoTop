import { redirect } from 'next/navigation'
import { Suspense } from "react"
import Link from "next/link"
import { Plus, Search, Filter, Eye, Pencil, Building2, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cookies } from 'next/headers'
import { getActiveTenants, getActivePropertiesWithUnits } from "./actions"
import { CreateLeaseDialog } from "@/components/leases/CreateLeaseDialog"

interface Lease {
  id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date?: string
  rent_amount: number
  status: string
}

interface Tenant {
  id: string
  name: string
  document?: string | null
}

interface PropertyWithUnits {
  id: string
  name: string
  units: { id: string; label: string }[]
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  ACTIVE: { label: "Ativo", class: "bg-primary/10 text-primary" },
  PENDING: { label: "Pendente", class: "bg-secondary/10 text-secondary" },
  ENDED: { label: "Encerrado", class: "bg-zinc-100 text-zinc-500" },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

async function getLeasesData() {
  let leases: Lease[] = []
  try {
    leases = await goFetch<Lease[]>("/api/v1/leases", {}) || []
  } catch (e) {
    console.error("Leases error:", e)
  }

  const total = leases.length
  const active = leases.filter((l) => l.status === "ACTIVE").length
  const pending = leases.filter((l) => l.status === "PENDING").length
  const expiringSoon = leases.filter((l) => {
    if (!l.end_date || l.status !== "ACTIVE") return false
    const endDate = new Date(l.end_date)
    const thirtyDays = new Date()
    thirtyDays.setDate(thirtyDays.getDate() + 30)
    return endDate <= thirtyDays && endDate > new Date()
  }).length

  return { leases, total, active, pending, expiringSoon }
}

async function LeasesList({ search, status, tenants, properties }: { search?: string; status?: string; tenants: Tenant[]; properties: PropertyWithUnits[] }) {
  const { leases, total, active, pending, expiringSoon } = await getLeasesData()

  let filtered = leases
  if (search) {
    filtered = filtered.filter((l) => l.id.toLowerCase().includes(search.toLowerCase()))
  }
  if (status && status !== "ALL") {
    filtered = filtered.filter((l) => l.status === status)
  }

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-zinc-200 rounded-xl bg-white">
        <p className="text-zinc-500 mb-4">Nenhum contrato encontrado.</p>
        <CreateLeaseDialog tenants={tenants} properties={properties} />
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3 mb-2"><Building2 className="w-5 h-5 text-primary"/><span className="text-sm text-zinc-600">Total</span></div><div className="text-2xl font-bold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3 mb-2"><CheckCircle className="w-5 h-5 text-green-600"/><span className="text-sm text-zinc-600">Ativos</span></div><div className="text-2xl font-bold">{active}</div></CardContent></Card>
        <Card className="border-l-4 border-l-secondary"><CardContent className="p-4"><div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-orange-600"/><span className="text-sm text-zinc-600">Pendentes</span></div><div className="text-2xl font-bold">{pending}</div></CardContent></Card>
        <Card className="border-l-4 border-l-error"><CardContent className="p-4"><div className="flex items-center gap-3 mb-2"><AlertCircle className="w-5 h-5 text-red-600"/><span className="text-sm text-zinc-600">Vencendo</span></div><div className="text-2xl font-bold">{expiringSoon}</div></CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase">Início</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase">Fim</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 text-right">Valor</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 text-center">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-400 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((lease) => (
              <tr key={lease.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono text-sm">{formatDate(lease.start_date)}</td>
                <td className="px-4 py-3 font-mono text-sm">{lease.end_date ? formatDate(lease.end_date) : "—"}</td>
                <td className="px-4 py-3 text-sm font-bold text-primary text-right">{formatCurrency(lease.rent_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUS_LABELS[lease.status]?.class || "bg-zinc-100"}>{STATUS_LABELS[lease.status]?.label || lease.status}</Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button variant="ghost" size="icon" className="w-8 h-8"><Eye className="w-4 h-4"/></Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8"><Pencil className="w-4 h-4"/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

export default async function LeasesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (!accessToken) {
    redirect('/login')
  }

  const { q, status } = await searchParams
  const tenants = await getActiveTenants()
  const properties = await getActivePropertiesWithUnits()

  return (
    <div className="container py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-zinc-500">Gerencie contratos de locação</p>
        </div>
        <CreateLeaseDialog tenants={tenants} properties={properties} />
      </div>

      <Card className="p-4">
        <form action="/leases" method="GET" className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4"/>
            <input name="q" placeholder="Buscar..." defaultValue={q} className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200"/>
          </div>
          <select name="status" defaultValue={status || "ALL"} className="h-10 px-4 rounded-xl border border-zinc-200">
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="PENDING">Pendente</option>
          </select>
          <Button type="submit" variant="outline"><Filter className="w-4 h-4"/></Button>
        </form>
      </Card>

      <Suspense fallback={<div className="text-center py-10">Carregando...</div>}>
        <LeasesList search={q} status={status} tenants={tenants} properties={properties} />
      </Suspense>
    </div>
  )
}