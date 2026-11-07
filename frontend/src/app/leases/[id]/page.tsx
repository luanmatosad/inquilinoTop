import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { goFetch } from "@/lib/go/client"
import { formatCurrency } from "@/lib/utils"
import { formatDateBR } from "@/lib/date-format"
import { maskDocumentPartial, maskPhone } from "@/lib/masks"
import {
  buildReadjustmentHistory,
  buildTerms,
  END_REASON_LABEL,
  paymentLabel,
  paymentMonth,
  recentRentPayments,
  type DetailPayment,
  type DetailReadjustment,
  type TermsLease,
} from "@/lib/lease-detail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EndLeaseDialog } from "@/components/leases/EndLeaseDialog"
import { LeaseFormSheet } from "@/components/leases/LeaseFormSheet"
import { LeaseDocuments, type LeaseDocument } from "@/components/leases/LeaseDocuments"
import { ReadjustSheet } from "@/components/leases/ReadjustSheet"
import type { LeaseEditData } from "@/components/leases/LeaseForm"

type ApiLease = TermsLease &
  LeaseEditData & {
    status: "ACTIVE" | "ENDED" | "CANCELED"
    end_reason?: string | null
  }
type ApiTenant = { id: string; name: string; email?: string | null; phone?: string | null; document?: string | null }
type ApiProperty = {
  id: string
  name: string
  units?: { id: string; label: string; reference_rent?: number | null }[] | null
}
type SearchParams = { editar?: string; encerrar?: string; reajustar?: string }

const STATUS = {
  ACTIVE: { label: "Ativo", variant: "default" },
  ENDED: { label: "Encerrado", variant: "secondary" },
  CANCELED: { label: "Cancelado", variant: "destructive" },
} as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">{children}</CardContent>
      </Card>
    </section>
  )
}

function Unavailable({ what }: { what: string }) {
  return <p className="text-muted-foreground">Não foi possível carregar {what}.</p>
}

export default async function LeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const { id } = await params
  const { editar, encerrar, reajustar } = await searchParams

  let lease: ApiLease | undefined
  try {
    lease = await goFetch<ApiLease>("/api/v1/leases/" + id, {})
  } catch (error) {
    console.error("Erro ao buscar contrato:", error)
  }
  if (!lease) notFound()

  const [paymentsRes, readjustRes, tenantsRes, propertiesRes, docsRes] = await Promise.allSettled([
    goFetch<DetailPayment[]>(`/api/v1/leases/${id}/payments`, {}),
    goFetch<DetailReadjustment[]>(`/api/v1/leases/${id}/readjustments`, {}),
    goFetch<ApiTenant[]>("/api/v1/tenants", {}),
    goFetch<ApiProperty[]>("/api/v1/properties", {}),
    goFetch<{ id: string; filename: string; created_at: string }[]>(`/api/v1/documents?entity_type=lease&entity_id=${id}`, {}),
  ])
  for (const [name, r] of [["cobranças", paymentsRes], ["reajustes", readjustRes], ["inquilinos", tenantsRes], ["imóveis", propertiesRes], ["documentos", docsRes]] as const) {
    if (r.status === "rejected") console.error(`Erro ao buscar ${name}:`, r.reason)
  }

  const tenants = tenantsRes.status === "fulfilled" ? (tenantsRes.value ?? []) : []
  const properties = propertiesRes.status === "fulfilled" ? (propertiesRes.value ?? []) : []
  const tenant = tenants.find((t) => t.id === lease.tenant_id)
  const unitOptions = properties.flatMap((p) =>
    (p.units ?? []).map((u) => ({ id: u.id, label: u.label, propertyName: p.name, referenceRent: u.reference_rent })),
  )
  const unit = unitOptions.find((u) => u.id === lease.unit_id)
  const where = unit ? `${unit.label} · ${unit.propertyName}` : "—"
  const active = lease.status === "ACTIVE"
  const st = STATUS[lease.status] ?? { label: lease.status, variant: "secondary" as const }

  const documents: LeaseDocument[] =
    docsRes.status === "fulfilled" ? (docsRes.value ?? []).map((d) => ({ id: d.id, filename: d.filename, created: formatDateBR(d.created_at) })) : []

  const recent = paymentsRes.status === "fulfilled" ? recentRentPayments(paymentsRes.value ?? []) : null
  const history = readjustRes.status === "fulfilled" ? buildReadjustmentHistory(lease, readjustRes.value ?? []) : null
  const now = new Date()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link href="/leases" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Voltar para contratos
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold leading-[1.2]">
            {where}
            <Badge variant={st.variant}>{st.label}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {tenant ? (
              <Link href={`/tenants/${tenant.id}`} className="hover:underline">
                {tenant.name}
              </Link>
            ) : (
              "—"
            )}
            {" · desde "}
            {formatDateBR(lease.start_date)}
          </p>
          {!active && lease.end_date && (
            <p className="text-sm text-muted-foreground">
              Saída em {formatDateBR(lease.end_date)}
              {lease.end_reason ? ` · ${END_REASON_LABEL[lease.end_reason] ?? lease.end_reason}` : ""}
            </p>
          )}
        </div>
        {active && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/leases/${id}?editar=1`}>Editar</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/leases/${id}?reajustar=1`}>Aplicar reajuste</Link>
            </Button>
            <Button asChild variant="destructive">
              <Link href={`/leases/${id}?encerrar=1`}>Encerrar contrato</Link>
            </Button>
          </div>
        )}
      </header>

      <Section title="Cobranças">
        {!recent ? (
          <Unavailable what="as cobranças" />
        ) : recent.total === 0 ? (
          <p className="text-muted-foreground">Nenhuma cobrança gerada para este contrato.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Vence em</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.shown.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{paymentMonth(p)}</TableCell>
                    <TableCell>{formatDateBR(p.due_date)}</TableCell>
                    <TableCell>{formatCurrency(p.gross_amount)}</TableCell>
                    <TableCell>{paymentLabel(p, now)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Mostrando as {recent.shown.length} mais recentes de {recent.total}.{" "}
              <Link href="/financial/receivables" className="underline">
                Ver todas
              </Link>
            </p>
          </>
        )}
      </Section>

      <Section title="Histórico de reajustes">
        {!history ? (
          <Unavailable what="os reajustes" />
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((r, i) => (
              <li key={i}>
                {r.when} · {r.label} · {r.percent} · {r.amount}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Termos">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {buildTerms(lease).map((t) => (
            <div key={t.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd>{t.value}</dd>
            </div>
          ))}
        </dl>
        {lease.notes && <p className="whitespace-pre-line border-t pt-3">{lease.notes}</p>}
      </Section>

      <Section title="Partes">
        {tenant ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Inquilino</span>
            <Link href={`/tenants/${tenant.id}`} className="font-medium hover:underline">
              {tenant.name}
            </Link>
            <span className="text-muted-foreground">
              {[maskDocumentPartial(tenant.document), tenant.email, maskPhone(tenant.phone)].filter(Boolean).join(" · ")}
            </span>
          </div>
        ) : (
          <Unavailable what="o inquilino" />
        )}
      </Section>

      <Section title="Documentos">
        {docsRes.status === "rejected" ? <Unavailable what="os documentos" /> : <LeaseDocuments leaseId={id} documents={documents} />}
      </Section>

      {active && (
        <>
          <LeaseFormSheet open={editar === "1"} units={unitOptions} tenants={tenants} lease={lease} />
          <ReadjustSheet
            open={reajustar === "1"}
            leaseId={id}
            currentRent={lease.rent_amount}
            defaultIndex={lease.adjustment_index}
            defaultDate={lease.next_readjustment?.slice(0, 10)}
            tenantName={tenant?.name}
            tenantPhone={tenant?.phone}
          />
          <EndLeaseDialog open={encerrar === "1"} leaseId={id} unitId={lease.unit_id} title={where} />
        </>
      )}
    </div>
  )
}
