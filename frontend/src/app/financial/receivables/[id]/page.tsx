import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { goFetch } from "@/lib/go/client"
import { sessionUserId } from "@/lib/go/session-user"
import { formatCurrency } from "@/lib/utils"
import { todaySaoPaulo } from "@/lib/lease-overview"
import { daysFromDue, pickReminder, type Reminder } from "@/lib/message-templates"
import { formatDateBR, monthName } from "@/lib/date-format"
import { maskPhone } from "@/lib/masks"
import { dailyToMonthly } from "@/lib/interest"
import { whenLabel } from "@/lib/public-charge"
import { buildTimeline, lateBreakdown, PAYMENT_METHOD_LABEL, fmtPercent, formatReceiptNumber, type TimelineApiItem } from "@/lib/receivable-detail"
import { getProfile } from "@/app/settings/profile/actions"
import { RegisterPaymentPanel } from "@/components/financial/RegisterPaymentDialog"
import { SendChargeDialog } from "@/components/financial/SendChargeDialog"
import { AgreementSheet } from "@/components/financial/AgreementSheet"
import { PaymentTimeline } from "@/components/financial/PaymentTimeline"
import { ReportNotice } from "@/components/financial/ReportNotice"
import { SituationBadge } from "@/components/financial/SituationBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ApiPayment = {
  id: string
  lease_id: string
  type: string
  status: "PENDING" | "PAID" | "LATE"
  competency?: string | null
  due_date: string
  paid_date?: string | null
  gross_amount: number
  late_fee_amount: number
  interest_amount: number
  discount_amount: number
  payment_method?: string | null
  receipt_number?: number | null
  receipt_year?: number | null
  awaiting_confirmation?: boolean
  reported_amount?: number | null
  reported_at?: string | null
  reported_date?: string | null
  has_proof?: boolean
}
type ApiLease = {
  id: string
  tenant_id: string
  unit_id: string
  start_date: string
  late_fee_percent?: number | null
  daily_interest_percent?: number | null
}
type ApiTenant = { id: string; name: string; email?: string | null; phone?: string | null }
type ApiProperty = { id: string; name: string; units?: { id: string; label: string }[] | null }
type SearchParams = { enviar?: string; pagar?: string; acordo?: string }

const LABELS = { LATE: "Atrasado", PAID: "Pago", PENDING: "Previsto", AWAITING: "Aguardando confirmação" } as const

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
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

export default async function ReceivablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const { id } = await params
  const { enviar, pagar, acordo } = await searchParams

  let payment: ApiPayment | undefined
  try {
    payment = await goFetch<ApiPayment>(`/api/v1/payments/${id}`, {})
  } catch (error) {
    console.error("Erro ao buscar cobrança:", error)
  }
  if (!payment) notFound()

  const [eventsRes, leaseRes, tenantsRes, propertiesRes, configRes, userId] = await Promise.all([
    goFetch<TimelineApiItem[]>(`/api/v1/payments/${id}/events`, {}).then((v) => ({ ok: true as const, v }), () => ({ ok: false as const })),
    goFetch<ApiLease>(`/api/v1/leases/${payment.lease_id}`, {}).then((v) => ({ ok: true as const, v }), () => ({ ok: false as const })),
    goFetch<ApiTenant[]>("/api/v1/tenants", {}).then((v) => ({ ok: true as const, v }), () => ({ ok: false as const })),
    goFetch<ApiProperty[]>("/api/v1/properties", {}).then((v) => ({ ok: true as const, v }), () => ({ ok: false as const })),
    goFetch<{ pix_key?: string | null }>("/api/v1/payments/config", {}).then((v) => ({ ok: true as const, v }), () => ({ ok: false as const })),
    sessionUserId(),
  ])

  const lease = leaseRes.ok ? leaseRes.v : undefined
  const tenant = lease && tenantsRes.ok ? (tenantsRes.v ?? []).find((t) => t.id === lease.tenant_id) : undefined
  const unit = lease && propertiesRes.ok
    ? (propertiesRes.v ?? []).flatMap((p) => (p.units ?? []).map((u) => ({ label: u.label, property: p.name, id: u.id }))).find((u) => u.id === lease.unit_id)
    : undefined
  const where = unit ? `${unit.label} · ${unit.property}` : "—"
  const month = payment.competency ? monthName(`${payment.competency}-01`).toLowerCase() : monthName(payment.due_date).toLowerCase()
  const open = payment.status !== "PAID"
  const late = payment.status === "LATE"
  const awaiting = open && !!payment.awaiting_confirmation && payment.reported_amount != null
  const pixConfigured = configRes.ok && !!configRes.v?.pix_key?.trim()
  const missing = [
    !leaseRes.ok && "contrato",
    !tenantsRes.ok && "inquilino",
    !propertiesRes.ok && "imóvel",
  ].filter(Boolean) as string[]

  const monthlyInterest = dailyToMonthly(lease?.daily_interest_percent)
  const breakdown = lateBreakdown({
    gross: payment.gross_amount,
    lateFee: payment.late_fee_amount,
    interest: payment.interest_amount,
    dueDate: payment.due_date,
    lateFeePercent: lease?.late_fee_percent ?? 0,
    monthlyInterestPercent: monthlyInterest,
  })
  const base = `/financial/receivables/${id}`

  // O Pix só é gerado quando o envio está aberto; sem chave (422) a mensagem sai sem ele.
  let pix: string | null = null
  let ownerFirstName: string | undefined
  // Modelo do lembrete que combina com os dias até o vencimento; sem os lembretes, o diálogo usa o texto fixo de antes.
  let template: { name: string; body: string } | null = null
  if (enviar === "1" && open) {
    const [pixRes, profile, reminders] = await Promise.all([
      goFetch<{ payload: string }>(`/api/v1/payments/${id}/pix`, {}).then((v) => v.payload, () => null),
      getProfile().catch(() => null),
      goFetch<{ reminders: Reminder[] }>("/api/v1/settings/reminders", {}).then((v) => v.reminders, () => null),
    ])
    pix = pixRes
    ownerFirstName = profile?.full_name?.trim().split(/\s+/)[0] || undefined
    const picked = pickReminder(reminders, daysFromDue(payment.due_date, todaySaoPaulo()))
    template = picked ? { name: picked.name, body: picked.body } : null
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link href="/financial/receivables" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Recebimentos
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold leading-[1.2]">
            {tenant?.name ?? "—"}
            <SituationBadge situation={payment.status === "PAID" ? "PAID" : awaiting ? "AWAITING" : late ? "LATE" : "PENDING"} labels={LABELS} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {where} · aluguel de {month}
          </p>
          {late && breakdown.daysLate > 0 && (
            <p className="text-sm text-muted-foreground">
              {breakdown.daysLate} {breakdown.daysLate === 1 ? "dia" : "dias"} de atraso. O valor cresce um pouco a cada dia.
            </p>
          )}
        </div>
        {open && (
          <div className="flex flex-wrap gap-2">
            {late && (
              <Button asChild variant="outline">
                <Link href={`${base}?acordo=1`}>Negociar atraso</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`${base}?enviar=1`}>{late ? "Cobrar de novo" : "Enviar cobrança"}</Link>
            </Button>
            <Button asChild>
              <Link href={`${base}?pagar=1`}>Registrar pagamento</Link>
            </Button>
          </div>
        )}
      </header>

      {missing.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Dados indisponíveis no momento ({missing.join(", ")}): alguns campos aparecem como “—”.
        </p>
      )}

      {awaiting && payment.reported_amount != null && (
        <Section title="Aviso do inquilino">
          <ReportNotice
            summary={`${tenant?.name ?? "O inquilino"} avisou ${payment.reported_at ? whenLabel(payment.reported_at).toLowerCase() : ""} que pagou ${formatCurrency(payment.reported_amount)}${payment.reported_date ? ` em ${formatDateBR(payment.reported_date)}` : ""}.`}
            info={{
              paymentId: id,
              tenantName: tenant?.name ?? "Inquilino",
              reportedAmount: formatCurrency(payment.reported_amount),
              reportedWhen: payment.reported_at ? whenLabel(payment.reported_at) : "",
              hasProof: !!payment.has_proof,
              differsFromDue: Math.abs(payment.reported_amount - breakdown.total) > 0.01,
              dueTotal: formatCurrency(breakdown.total),
            }}
          />
        </Section>
      )}

      <Section title="Linha do tempo">
        {eventsRes.ok ? (
          <PaymentTimeline rows={buildTimeline(eventsRes.v ?? [], userId)} />
        ) : (
          <p className="text-muted-foreground">Não foi possível carregar a linha do tempo.</p>
        )}
      </Section>

      {late && (
        <Section title="Valor atualizado hoje">
          <p className="text-muted-foreground">Multa e juros calculados pelas regras do contrato.</p>
          {breakdown.lines.map((l) => (
            <Field key={l.label} label={l.label}>
              {formatCurrency(l.value)}
            </Field>
          ))}
          <Field label="Total hoje">
            <strong>{formatCurrency(breakdown.total)}</strong>
          </Field>
        </Section>
      )}

      <Section title="Cobrança">
        <Field label="Valor">{formatCurrency(payment.gross_amount)}</Field>
        <Field label="Vence em">{formatDateBR(payment.due_date)}</Field>
        <Field label="Multa e juros">
          {lease ? `${fmtPercent(lease.late_fee_percent ?? 0)}% + ${fmtPercent(monthlyInterest)}% ao mês` : "—"}
        </Field>
        {payment.status === "PAID" ? (
          <>
            <Field label="Pago em">{`Pago em ${formatDateBR(payment.paid_date)}`}</Field>
            <Field label="Forma de pagamento">{PAYMENT_METHOD_LABEL[payment.payment_method ?? ""] ?? "—"}</Field>
            {payment.discount_amount > 0 && <Field label="Desconto">{formatCurrency(payment.discount_amount)}</Field>}
            <Field label="Recibo">
              <Link href={`${base}/receipt`} className="underline">
                Recibo Nº {formatReceiptNumber(payment.receipt_number, payment.receipt_year)}
              </Link>
            </Field>
          </>
        ) : (
          <Field label="Recebe em">
            {pixConfigured ? (
              "Chave Pix cadastrada"
            ) : (
              <span>
                Chave Pix não cadastrada.{" "}
                <Link href="/settings/pix" className="underline">
                  Cadastrar chave
                </Link>
              </span>
            )}
          </Field>
        )}
      </Section>

      <Section title="Inquilino">
        {tenant ? (
          <>
            <Field label="Nome">
              <Link href={`/tenants/${tenant.id}`} className="hover:underline">
                {tenant.name}
              </Link>
            </Field>
            <Field label="Contato">{[maskPhone(tenant.phone), tenant.email].filter(Boolean).join(" · ") || "—"}</Field>
          </>
        ) : (
          <p className="text-muted-foreground">Inquilino indisponível.</p>
        )}
        {lease && (
          <Field label="Contrato">
            <Link href={`/leases/${lease.id}`} className="underline">
              desde {formatDateBR(lease.start_date)}
            </Link>
          </Field>
        )}
      </Section>
      {open && (
        <RegisterPaymentPanel
          open={pagar === "1"}
          item={{
            id,
            tenant: tenant?.name ?? "—",
            where,
            due: formatDateBR(payment.due_date).slice(0, 5),
            amount: formatCurrency(payment.gross_amount),
            grossAmount: payment.gross_amount,
            totalDue: breakdown.total,
            updatedTotal: late ? formatCurrency(breakdown.total) : undefined,
            situation: late ? "LATE" : "PENDING",
          }}
        />
      )}
      {open && (
        <SendChargeDialog
          open={enviar === "1"}
          paymentId={id}
          late={late}
          tenantName={tenant?.name ?? "inquilino"}
          tenantPhone={tenant?.phone}
          tenantEmail={tenant?.email}
          month={month}
          where={where}
          amount={late ? breakdown.total : payment.gross_amount}
          dueLabel={formatDateBR(payment.due_date).slice(0, 5)}
          pix={pix}
          ownerFirstName={ownerFirstName}
          template={template}
        />
      )}
      {late && (
        <AgreementSheet
          open={acordo === "1"}
          paymentId={id}
          tenantName={tenant?.name ?? "o inquilino"}
          today={todaySaoPaulo()}
          total={breakdown.total}
        />
      )}
    </div>
  )
}
