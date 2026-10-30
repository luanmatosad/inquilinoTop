import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import { Card } from '@/components/ui/card'
import { PrintButton } from '@/components/financial/PrintButton'
import { fmtDate, money } from '@/components/financial/shared'
import { maskCpfCnpj } from '@/lib/masks'

interface Party {
  name: string
  document?: string
}

interface Receipt {
  payment_id: string
  competency?: string
  issued_at: string
  owner: Party
  tenant: Party
  unit: { label?: string; property_address?: string }
  amounts: { gross: number; late_fee: number; interest: number; irrf_withheld: number; net_paid: number }
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
        <div className="container py-8 space-y-4">
          <p className="text-muted-foreground">Esta cobrança ainda não foi paga; o recibo só existe depois da baixa.</p>
          <Link href="/financial/receivables" className="underline">Voltar para contas a receber</Link>
        </div>
      )
    }
    console.error('Erro ao buscar recibo:', error)
    notFound()
  }
  if (!receipt) notFound()

  const a = receipt.amounts
  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/financial/receivables" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Contas a receber
        </Link>
        <PrintButton />
      </div>

      <Card className="p-8 space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Recibo de aluguel</h1>
          {receipt.competency && <p className="text-muted-foreground">Competência {receipt.competency}</p>}
        </header>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted-foreground">Locador</dt><dd className="font-medium">{receipt.owner.name}{receipt.owner.document ? ` · ${maskCpfCnpj(receipt.owner.document)}` : ''}</dd></div>
          <div><dt className="text-muted-foreground">Locatário</dt><dd className="font-medium">{receipt.tenant.name}{receipt.tenant.document ? ` · ${maskCpfCnpj(receipt.tenant.document)}` : ''}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Imóvel</dt><dd className="font-medium">{[receipt.unit.label, receipt.unit.property_address].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div><dt className="text-muted-foreground">Pago em</dt><dd className="font-medium">{fmtDate(receipt.paid_date)}</dd></div>
        </dl>

        <table className="w-full text-sm">
          <tbody className="divide-y">
            <Row label="Valor" value={money(a.gross)} />
            {a.late_fee > 0 && <Row label="Multa" value={money(a.late_fee)} />}
            {a.interest > 0 && <Row label="Juros" value={money(a.interest)} />}
            {a.irrf_withheld > 0 && <Row label="IRRF retido" value={`- ${money(a.irrf_withheld)}`} />}
            <Row label="Total recebido" value={money(a.net_paid)} strong />
          </tbody>
        </table>

        {receipt.legal_note && <p className="text-xs text-muted-foreground">{receipt.legal_note}</p>}
        <p className="text-xs text-muted-foreground">Emitido em {new Date(receipt.issued_at).toLocaleDateString('pt-BR')}</p>
      </Card>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td className={`py-2 ${strong ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</td>
      <td className={`py-2 text-right ${strong ? 'font-semibold' : ''}`}>{value}</td>
    </tr>
  )
}
