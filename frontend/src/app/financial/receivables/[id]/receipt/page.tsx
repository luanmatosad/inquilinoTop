import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import { formatDateBR, monthName } from '@/lib/date-format'
import { maskDocumentPartial } from '@/lib/masks'
import { PAYMENT_METHOD_LABEL } from '@/lib/receivable-detail'
import { formatCurrency } from '@/lib/utils'
import { valorPorExtenso } from '@/lib/valor-por-extenso'
import { PrintButton } from '@/components/financial/PrintButton'

interface Party {
  name: string
  document?: string
}

interface Receipt {
  payment_id: string
  number?: string
  competency?: string
  issued_at: string
  owner: Party
  tenant: Party
  unit: { label?: string; property_address?: string }
  amounts: { gross: number; late_fee: number; interest: number; discount?: number; irrf_withheld: number; net_paid: number }
  payment_method?: string
  paid_date: string
  legal_note: string
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let receipt: Receipt
  try {
    receipt = await goFetch<Receipt>(`/api/v1/payments/${id}/receipt`, {})
  } catch (error) {
    const { status } = goErrorInfo(error)
    if (status === 409) {
      return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <p className="text-muted-foreground">Esta cobrança ainda não foi paga; o recibo só existe depois do pagamento.</p>
          <Link href="/financial/receivables" className="underline">
            Voltar para Recebimentos
          </Link>
        </div>
      )
    }
    console.error('Erro ao buscar recibo:', error)
    notFound()
  }
  if (!receipt) notFound()

  const a = receipt.amounts
  const received = a.net_paid
  const month = receipt.competency ? `${monthName(`${receipt.competency}-01`).toLowerCase()} de ${receipt.competency.slice(0, 4)}` : null
  const method = receipt.payment_method ? (PAYMENT_METHOD_LABEL[receipt.payment_method] ?? receipt.payment_method) : null
  const where = [receipt.unit.label, receipt.unit.property_address].filter(Boolean).join(', ')
  const rows: [string, string][] = [
    ['Valor', formatCurrency(a.gross)],
    ...(a.late_fee > 0 ? ([['Multa', formatCurrency(a.late_fee)]] as [string, string][]) : []),
    ...(a.interest > 0 ? ([['Juros', formatCurrency(a.interest)]] as [string, string][]) : []),
    ...((a.discount ?? 0) > 0 ? ([['Desconto', `- ${formatCurrency(a.discount ?? 0)}`]] as [string, string][]) : []),
    ...(a.irrf_withheld > 0 ? ([['IRRF retido', `- ${formatCurrency(a.irrf_withheld)}`]] as [string, string][]) : []),
    ['Total recebido', formatCurrency(received)],
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1 print:hidden">
        <Link href="/financial/receivables" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Recebimentos
        </Link>
        <h1 className="text-2xl font-semibold leading-tight">Recibo{month ? ` de ${month.split(' ')[0]}` : ''}</h1>
        <p className="text-sm text-muted-foreground">
          {receipt.tenant.name}
          {where ? ` · ${where}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <article className="flex max-w-[660px] flex-1 basis-[560px] flex-col gap-5 rounded-xl border bg-background p-10 shadow-sm print:border-0 print:shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs tracking-widest text-muted-foreground">RECIBO DE ALUGUEL</div>
              <div className="text-2xl font-semibold">Nº {receipt.number || '—'}</div>
            </div>
            <div className="text-2xl font-semibold">{formatCurrency(received)}</div>
          </div>

          <p className="text-[15px] leading-6">
            Recebi de <b>{receipt.tenant.name}</b>
            {receipt.tenant.document ? ` (documento ${maskDocumentPartial(receipt.tenant.document)})` : ''} a quantia de{' '}
            <b>{formatCurrency(received)}</b> ({valorPorExtenso(received)})
            {month ? (
              <>
                , referente ao aluguel de <b>{month}</b>
              </>
            ) : null}
            {where ? (
              <>
                {' '}
                do imóvel <b>{where}</b>
              </>
            ) : null}
            .
          </p>

          <p className="text-sm text-muted-foreground">
            {method ? `Pago por ${method} em ${formatDateBR(receipt.paid_date)}.` : `Pago em ${formatDateBR(receipt.paid_date)}.`}
          </p>

          <table className="w-full text-sm">
            <tbody className="divide-y">
              {rows.map(([label, value], i) => {
                const strong = i === rows.length - 1
                return (
                  <tr key={label}>
                    <td className={`py-2 ${strong ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</td>
                    <td className={`py-2 text-right ${strong ? 'font-semibold' : ''}`}>{value}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="mt-8 w-3/5 border-t border-foreground pt-2">
            <div className="text-sm font-medium">{receipt.owner.name}</div>
            <div className="text-xs text-muted-foreground">{receipt.owner.document ? maskDocumentPartial(receipt.owner.document) : 'Locador'}</div>
          </div>

          <div className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
            {receipt.legal_note && <p>{receipt.legal_note}</p>}
            <p>Recibo gerado pelo ImoviFlow em {formatDateBR(receipt.issued_at.slice(0, 10))}.</p>
          </div>
        </article>

        <aside className="flex flex-col gap-2 print:hidden md:w-64">
          <PrintButton label="Baixar PDF" primary />
          <p className="text-xs text-muted-foreground">No diálogo de impressão, escolha “Salvar como PDF”.</p>
        </aside>
      </div>
    </div>
  )
}
