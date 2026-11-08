import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import { formatDateBR, monthName } from '@/lib/date-format'
import type { PublicReceipt } from '@/lib/public-charge'
import { PAYMENT_METHOD_LABEL } from '@/lib/receivable-detail'
import { formatCurrency } from '@/lib/utils'
import { valorPorExtenso } from '@/lib/valor-por-extenso'
import { PrintButton } from '@/components/financial/PrintButton'

/** Recibo para o inquilino: o backend já tira documentos e endereço; aqui só nomes, unidade e valores. */
export default async function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const back = (
    <Link href={`/p/${token}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground print:hidden">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar
    </Link>
  )

  let receipt: PublicReceipt
  try {
    receipt = await goFetch<PublicReceipt>(`/api/v1/public/payments/${encodeURIComponent(token)}/receipt`, { skipAuth: true })
  } catch (error) {
    const { status } = goErrorInfo(error)
    if (status === 409) {
      return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
          {back}
          <p className="text-muted-foreground">Esta cobrança ainda não foi confirmada; o recibo só existe depois do pagamento.</p>
        </main>
      )
    }
    if (status === 404) notFound()
    throw error
  }

  const a = receipt.amounts
  const received = a.net_paid
  const month = receipt.competency ? `${monthName(`${receipt.competency}-01`).toLowerCase()} de ${receipt.competency.slice(0, 4)}` : null
  const method = receipt.payment_method ? (PAYMENT_METHOD_LABEL[receipt.payment_method] ?? receipt.payment_method) : null
  const rows: [string, string][] = [
    ['Valor', formatCurrency(a.gross)],
    ...(a.late_fee > 0 ? ([['Multa', formatCurrency(a.late_fee)]] as [string, string][]) : []),
    ...(a.interest > 0 ? ([['Juros', formatCurrency(a.interest)]] as [string, string][]) : []),
    ...((a.discount ?? 0) > 0 ? ([['Desconto', `- ${formatCurrency(a.discount ?? 0)}`]] as [string, string][]) : []),
    ['Total pago', formatCurrency(received)],
  ]

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
      {back}
      <article className="flex flex-col gap-5 rounded-xl border bg-background p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-muted-foreground">RECIBO DE ALUGUEL</div>
            <div className="text-xl font-semibold">Nº {receipt.number || '—'}</div>
          </div>
          <div className="text-xl font-semibold">{formatCurrency(received)}</div>
        </div>

        <p className="text-[15px] leading-6">
          Recebi de <b>{receipt.tenant.name}</b> a quantia de <b>{formatCurrency(received)}</b> ({valorPorExtenso(received)})
          {month ? (
            <>
              , referente ao aluguel de <b>{month}</b>
            </>
          ) : null}
          {receipt.unit.label ? (
            <>
              {' '}
              do imóvel <b>{receipt.unit.label}</b>
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

        <div className="mt-6 w-3/5 border-t border-foreground pt-2">
          <div className="text-sm font-medium">{receipt.owner.name}</div>
          <div className="text-xs text-muted-foreground">Locador</div>
        </div>

        <div className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
          {receipt.legal_note && <p>{receipt.legal_note}</p>}
          <p>Recibo gerado pelo ImoviFlow em {formatDateBR(receipt.issued_at.slice(0, 10))}.</p>
        </div>
      </article>
      <div className="print:hidden">
        <PrintButton label="Imprimir ou salvar em PDF" primary />
      </div>
    </main>
  )
}
