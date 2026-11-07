import Link from "next/link"
import { notFound } from "next/navigation"
import { MessageCircle } from "lucide-react"

import { goFetch } from "@/lib/go/client"
import { formatCurrency } from "@/lib/utils"
import { formatDateBR, monthName } from "@/lib/date-format"
import { maskDocumentPartial, maskPhone } from "@/lib/masks"
import { whatsappUrl } from "@/lib/whatsapp"
import {
  buildTenantOverview,
  currentMonthRange,
  type OverviewLease,
  type OverviewPayment,
  type OverviewProperty,
} from "@/lib/tenant-overview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BillingBadge, type BillingDisplay } from "@/components/tenants/BillingBadge"
import { TenantFormSheet } from "@/components/tenants/TenantFormSheet"
import type { TenantFormData } from "@/components/tenants/TenantForm"

type ApiTenant = TenantFormData & { is_active: boolean }

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  )
}

export default async function TenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ editar?: string }>
}) {
  const { id } = await params
  const { editar } = await searchParams
  const { from, to } = currentMonthRange()

  let tenant: ApiTenant | undefined
  try {
    tenant = await goFetch<ApiTenant>("/api/v1/tenants/" + id, {})
  } catch (error) {
    console.error("Erro ao buscar inquilino:", error)
  }
  if (!tenant) notFound()

  const [leasesRes, propertiesRes, monthRes, lateRes] = await Promise.allSettled([
    goFetch<OverviewLease[]>("/api/v1/leases", {}),
    goFetch<OverviewProperty[]>("/api/v1/properties", {}),
    goFetch<OverviewPayment[]>(`/api/v1/payments?from=${from}&to=${to}`, {}),
    goFetch<OverviewPayment[]>("/api/v1/payments?status=LATE", {}),
  ])
  const leasesOk = leasesRes.status === "fulfilled"
  const propertiesOk = propertiesRes.status === "fulfilled"
  const paymentsOk = monthRes.status === "fulfilled" && lateRes.status === "fulfilled"
  for (const [name, r] of [["contratos", leasesRes], ["imóveis", propertiesRes], ["pagamentos do mês", monthRes], ["pagamentos atrasados", lateRes]] as const) {
    if (r.status === "rejected") console.error(`Erro ao buscar ${name}:`, r.reason)
  }

  const o = buildTenantOverview({
    tenants: [tenant],
    leases: leasesOk ? (leasesRes.value ?? []).filter((l) => l.tenant_id === tenant.id) : [],
    properties: propertiesOk ? (propertiesRes.value ?? []) : [],
    monthPayments: monthRes.status === "fulfilled" ? (monthRes.value ?? []) : [],
    latePayments: lateRes.status === "fulfilled" ? (lateRes.value ?? []) : [],
  }).get(tenant.id)!

  const lease = leasesOk ? o.lease : null
  const noLease = leasesOk && !o.lease
  const wa = whatsappUrl(tenant.phone)
  const contact = [tenant.email, maskPhone(tenant.phone)].filter(Boolean).join(" · ")
  const docLabel = tenant.person_type === "PJ" ? "CNPJ" : "CPF"
  const monthPayment = o.monthPayment
  const headerBilling: BillingDisplay = leasesOk && paymentsOk ? o.billing : "UNAVAILABLE"

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-1">
          <nav aria-label="Navegação" className="text-sm text-muted-foreground">
            <Link href="/tenants" className="hover:underline">
              Inquilinos
            </Link>{" "}
            › Detalhe
          </nav>
          <h1 className="text-2xl font-semibold leading-tight">{tenant.name}</h1>
          {contact && <p className="text-sm text-muted-foreground">{contact}</p>}
          <div role="group" aria-label="Situação de cobrança" className="pt-1">
            {noLease ? <Badge variant="outline">Sem contrato</Badge> : <BillingBadge status={headerBilling} />}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/tenants/${tenant.id}?editar=1`}>Editar</Link>
          </Button>
          {wa && (
            <Button asChild variant="outline">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                Abrir WhatsApp
              </a>
            </Button>
          )}
          {noLease && (
            <Button asChild>
              <Link href={`/leases?novo=1&inquilino=${tenant.id}`}>Criar contrato</Link>
            </Button>
          )}
        </div>
      </div>

      {!leasesOk && (
        <p role="status" className="text-sm text-muted-foreground">
          Contratos indisponíveis no momento. Tente recarregar a página.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {lease && (
          <Section title="Cobrança do mês">
            {!paymentsOk ? (
              <p className="text-muted-foreground">A cobrança do mês está indisponível no momento.</p>
            ) : monthPayment ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-medium">
                    {monthName(monthPayment.due_date)} · {formatCurrency(monthPayment.gross_amount)}
                  </span>
                  <BillingBadge status={monthPayment.status as BillingDisplay} />
                </div>
                <span className="text-muted-foreground">Vence em {formatDateBR(monthPayment.due_date)}</span>
                <Button asChild variant="outline" className="self-start">
                  <Link href="/financial/receivables">Ver cobrança</Link>
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">Nenhuma cobrança neste mês.</p>
            )}
          </Section>
        )}

        {lease && (
          <Section title="Contrato atual">
            <Field label="Unidade">
              {o.unit && o.property ? `${o.unit.label} · ${o.property.name}` : "—"}
            </Field>
            <Field label="Aluguel">{lease.rent_amount != null ? formatCurrency(lease.rent_amount) : "—"}</Field>
            <Field label="Vencimento">{lease.payment_day ? `Vence todo dia ${lease.payment_day}` : "—"}</Field>
            <Button asChild variant="outline" className="self-start">
              <Link href={`/leases/${lease.id}`}>Ver contrato</Link>
            </Button>
          </Section>
        )}

        {noLease && (
          <Section title="Sem contrato">
            <p className="text-muted-foreground">Para gerar cobranças, ligue este inquilino a uma unidade.</p>
            <Button asChild className="self-start">
              <Link href={`/leases?novo=1&inquilino=${tenant.id}`}>Criar contrato</Link>
            </Button>
          </Section>
        )}

        {tenant.notes && (
          <Section title="Observações">
            <p>{tenant.notes}</p>
          </Section>
        )}

        <Section title="Contato">
          <Field label="E-mail">{tenant.email || "—"}</Field>
          <Field label="Celular">{maskPhone(tenant.phone) || "—"}</Field>
          <Field label={docLabel}>{maskDocumentPartial(tenant.document) || "—"}</Field>
          {wa && (
            <Button asChild variant="outline" className="self-start">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                Abrir WhatsApp
              </a>
            </Button>
          )}
        </Section>
      </div>

      {/* O documento completo só viaja para o navegador com o painel de edição aberto. */}
      <TenantFormSheet open={editar === "1"} tenant={editar === "1" ? tenant : undefined} />
    </div>
  )
}
