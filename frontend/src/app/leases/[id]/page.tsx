import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { goFetch } from "@/lib/go/client"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LeaseActions } from "@/components/leases/LeaseActions"

interface Lease {
  id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date?: string | null
  rent_amount: number
  deposit_amount?: number | null
  payment_day: number
  status: "ACTIVE" | "ENDED" | "CANCELED"
  late_fee_percent: number
  daily_interest_percent: number
  iptu_reimbursable: boolean
  annual_iptu_amount?: number | null
  notes?: string | null
}

interface Payment {
  id: string
  competency?: string | null
  due_date: string
  paid_date?: string | null
  gross_amount: number
  status: "PENDING" | "PAID" | "LATE"
  type: string
}

interface Readjustment {
  id: string
  applied_at: string
  old_amount: number
  new_amount: number
  percentage: number
  index_name?: string | null
  notes?: string | null
}

const STATUS: Record<Lease["status"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Ativo", variant: "default" },
  ENDED: { label: "Encerrado", variant: "secondary" },
  CANCELED: { label: "Cancelado", variant: "destructive" },
}

const PAYMENT_STATUS: Record<Payment["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendente", variant: "outline" },
  PAID: { label: "Pago", variant: "default" },
  LATE: { label: "Atrasado", variant: "destructive" },
}

const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
// Datas do backend são DATE (meia-noite UTC): formatar em UTC evita voltar um dia no fuso do Brasil.
const date = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: "UTC" })

async function safe<T>(path: string): Promise<{ data: T | null; failed: boolean }> {
  try {
    return { data: (await goFetch<T>(path, {})) ?? null, failed: false }
  } catch (error) {
    console.error("Erro ao buscar", path, error)
    return { data: null, failed: true }
  }
}

async function LeaseDetails({ id }: { id: string }) {
  let lease: Lease
  try {
    lease = await goFetch<Lease>("/api/v1/leases/" + id, {})
  } catch (error) {
    console.error("Erro ao buscar contrato:", error)
    notFound()
  }
  if (!lease) notFound()

  const [payments, readjustments, properties, tenants] = await Promise.all([
    safe<Payment[]>(`/api/v1/leases/${id}/payments`),
    safe<Readjustment[]>(`/api/v1/leases/${id}/readjustments`),
    safe<{ name: string; units: { id: string; label: string }[] }[]>("/api/v1/properties"),
    safe<{ id: string; name: string }[]>("/api/v1/tenants"),
  ])

  const unit = properties.data
    ?.flatMap((p) => (p.units ?? []).map((u) => ({ property: p.name, label: u.label, id: u.id })))
    .find((u) => u.id === lease.unit_id)
  const tenant = tenants.data?.find((t) => t.id === lease.tenant_id)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {unit ? `${unit.property} - ${unit.label}` : "Contrato"}
            <Badge variant={STATUS[lease.status]?.variant ?? "secondary"}>{STATUS[lease.status]?.label ?? lease.status}</Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            {tenant ? (
              <Link href={`/tenants/${tenant.id}`} className="hover:underline">{tenant.name}</Link>
            ) : (
              "Inquilino"
            )}
            {" · "}
            {date(lease.start_date)} {lease.end_date ? `até ${date(lease.end_date)}` : "(prazo indeterminado)"}
          </p>
        </div>
        {lease.status === "ACTIVE" && (
          <LeaseActions leaseId={lease.id} unitId={lease.unit_id} currentEndDate={lease.end_date} />
        )}
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="cobrancas">Cobranças ({payments.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="reajustes">Reajustes ({readjustments.data?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card className="p-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <Field label="Aluguel" value={money(lease.rent_amount)} />
              <Field label="Caução" value={lease.deposit_amount != null ? money(lease.deposit_amount) : "—"} />
              <Field label="Dia de vencimento" value={String(lease.payment_day)} />
              <Field label="Multa por atraso" value={`${lease.late_fee_percent}%`} />
              <Field label="Juros diários" value={`${lease.daily_interest_percent}%`} />
              <Field
                label="IPTU reembolsável"
                value={lease.iptu_reimbursable ? `Sim${lease.annual_iptu_amount != null ? ` (${money(lease.annual_iptu_amount)}/ano)` : ""}` : "Não"}
              />
            </dl>
            {lease.notes && <p className="mt-6 text-sm whitespace-pre-line border-t pt-4">{lease.notes}</p>}
          </Card>
        </TabsContent>

        <TabsContent value="cobrancas">
          <Card>
            {payments.failed ? (
              <p className="p-6 text-muted-foreground">Não foi possível carregar as cobranças.</p>
            ) : !payments.data?.length ? (
              <p className="p-6 text-muted-foreground">Nenhuma cobrança gerada para este contrato.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.competency ?? "—"}</TableCell>
                      <TableCell>{date(p.due_date)}</TableCell>
                      <TableCell>{p.type === "RENT" ? "Aluguel" : p.type === "EXPENSE" ? "IPTU/Despesa" : p.type}</TableCell>
                      <TableCell className="text-right">{money(p.gross_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={PAYMENT_STATUS[p.status]?.variant ?? "outline"}>{PAYMENT_STATUS[p.status]?.label ?? p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="reajustes">
          <Card>
            {readjustments.failed ? (
              <p className="p-6 text-muted-foreground">Não foi possível carregar os reajustes.</p>
            ) : !readjustments.data?.length ? (
              <p className="p-6 text-muted-foreground">Nenhum reajuste aplicado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aplicado em</TableHead>
                    <TableHead>Índice</TableHead>
                    <TableHead className="text-right">Percentual</TableHead>
                    <TableHead className="text-right">De</TableHead>
                    <TableHead className="text-right">Para</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readjustments.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{date(r.applied_at)}</TableCell>
                      <TableCell>{r.index_name ?? "—"}</TableCell>
                      <TableCell className="text-right">{(r.percentage * 100).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}%</TableCell>
                      <TableCell className="text-right">{money(r.old_amount)}</TableCell>
                      <TableCell className="text-right">{money(r.new_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

export default async function LeasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="container py-8 space-y-6">
      <Link href="/leases" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para contratos
      </Link>
      <Suspense fallback={<div>Carregando contrato...</div>}>
        <LeaseDetails id={id} />
      </Suspense>
    </div>
  )
}
