import { redirect } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { cookies } from "next/headers"
import { Eye, Filter } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CreateInspectionDialog } from "@/components/inspections/CreateInspectionDialog"
import { formatDate, getLeaseOptions, type Inspection, type LeaseOption } from "@/lib/inspection-data"
import { INSPECTION_STATUS_LABELS, INSPECTION_TYPE_LABELS } from "@/lib/inspection-schemas"

type Filters = { lease_id?: string; type?: string; status?: string }

async function InspectionsList({ filters, leases }: { filters: Filters; leases: LeaseOption[] }) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) if (v && v !== "ALL") qs.set(k, v)

  let list: Inspection[]
  try {
    list = (await goFetch<Inspection[]>(`/api/v1/inspections${qs.size ? `?${qs}` : ""}`, {})) ?? []
  } catch (error) {
    console.error("Erro ao buscar laudos:", error)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground">Não foi possível carregar os laudos.</p>
        <Button variant="outline" asChild><Link href="/inspections">Tentar novamente</Link></Button>
      </div>
    )
  }

  if (!list.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground">Nenhum laudo encontrado.</p>
        <CreateInspectionDialog leases={leases} />
      </div>
    )
  }

  const leaseLabel = new Map(leases.map((l) => [l.id, l.label]))
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contrato</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{leaseLabel.get(i.lease_id) ?? "—"}</TableCell>
              <TableCell>{INSPECTION_TYPE_LABELS[i.type]}</TableCell>
              <TableCell className="font-mono text-sm">{formatDate(i.inspected_at)}</TableCell>
              <TableCell className="text-center">
                <Badge variant={i.status === "COMPLETED" ? "default" : "secondary"}>{INSPECTION_STATUS_LABELS[i.status]}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <Button variant="ghost" size="icon" className="w-8 h-8" asChild>
                  <Link href={`/inspections/${i.id}`} aria-label="Ver laudo"><Eye className="w-4 h-4" /></Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

const selectClass = "h-10 px-4 rounded-md border border-input bg-background text-sm"

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const cookieStore = await cookies()
  if (!cookieStore.get("access_token")?.value) redirect("/login")

  const filters = await searchParams
  const leases = await getLeaseOptions()

  return (
    <div className="container py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Laudos de vistoria</h1>
          <p className="text-muted-foreground">Estado do imóvel na entrada e na saída de cada contrato</p>
        </div>
        <CreateInspectionDialog leases={leases} />
      </div>

      <Card className="p-4">
        <form action="/inspections" method="GET" className="flex flex-wrap gap-4">
          <select name="lease_id" defaultValue={filters.lease_id || "ALL"} aria-label="Filtrar por contrato" className={`${selectClass} flex-1 min-w-48`}>
            <option value="ALL">Todos os contratos</option>
            {leases.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <select name="type" defaultValue={filters.type || "ALL"} aria-label="Filtrar por tipo" className={selectClass}>
            <option value="ALL">Todos os tipos</option>
            <option value="ENTRY">Entrada</option>
            <option value="EXIT">Saída</option>
          </select>
          <select name="status" defaultValue={filters.status || "ALL"} aria-label="Filtrar por status" className={selectClass}>
            <option value="ALL">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="COMPLETED">Concluído</option>
          </select>
          <Button type="submit" variant="outline" aria-label="Filtrar"><Filter className="w-4 h-4" /></Button>
        </form>
      </Card>

      <Suspense fallback={<div className="text-center py-10">Carregando...</div>}>
        <InspectionsList filters={filters} leases={leases} />
      </Suspense>
    </div>
  )
}
