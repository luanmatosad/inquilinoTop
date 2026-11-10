import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Circle, Download } from 'lucide-react'
import QRCode from 'qrcode'

import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import { formatDateBR } from '@/lib/date-format'
import { todaySaoPaulo } from '@/lib/lease-overview'
import { chargeTitle, firstName, whenLabel, type PublicCharge } from '@/lib/public-charge'
import { formatCurrency } from '@/lib/utils'
import { LandlordLine, PublicShell } from '@/components/public-charge/PublicShell'
import { PixPanel } from '@/components/public-charge/PixPanel'
import { ReportForm } from '@/components/public-charge/ReportForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ avisar?: string }> }

const api = (token: string) => `/api/v1/public/payments/${encodeURIComponent(token)}`

async function loadCharge(token: string): Promise<PublicCharge> {
  try {
    return await goFetch<PublicCharge>(api(token), { skipAuth: true })
  } catch (error) {
    if (goErrorInfo(error).status === 404) notFound()
    throw error
  }
}

/** Pix do dia; `null` quando o locador não cadastrou a chave. Link inválido é tratado como 404. */
async function loadPix(token: string): Promise<{ payload: string; qrSvg: string; receiverName?: string } | null> {
  try {
    const pix = await goFetch<{ payload: string; receiver_name?: string }>(`${api(token)}/pix`, { skipAuth: true })
    const qrSvg = await QRCode.toString(pix.payload, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
    return { payload: pix.payload, qrSvg, receiverName: pix.receiver_name }
  } catch (error) {
    const { status, code } = goErrorInfo(error)
    if (status === 404) notFound()
    if (code === 'PIX_KEY_NOT_CONFIGURED') return null
    throw error
  }
}

function Summary({ charge, tag }: { charge: PublicCharge; tag?: string }) {
  const where = charge.unit_label
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{tag ? `${chargeTitle(charge)} · ${tag}` : chargeTitle(charge)}</span>
      </div>
      <div className="text-[32px] font-semibold leading-10">{formatCurrency(charge.amount)}</div>
      {where && <div className="text-sm text-muted-foreground">{where}</div>}
      <div className="flex justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">Vence em</span>
        <span className="text-sm font-medium">{formatDateBR(charge.due_date)}</span>
      </div>
    </Card>
  )
}

export default async function PublicChargePage({ params, searchParams }: Props) {
  const { token } = await params
  const { avisar } = await searchParams
  const charge = await loadCharge(token)
  const landlord = firstName(charge.landlord_name)
  const open = charge.status === 'PENDING' || charge.status === 'LATE'

  if (charge.status === 'PAID') {
    return (
      <PublicShell title="Cobrança paga">
        <LandlordLine name={charge.landlord_name} />
        <Summary charge={charge} tag="pago" />
        <div>
          <Badge variant="outline">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
            Pago em {formatDateBR(charge.paid_date).slice(0, 5)}
          </Badge>
        </div>
        <Button asChild className="h-11 w-full">
          <Link href={`/p/${token}/recibo`}>
            <Download className="size-4" aria-hidden="true" />
            Baixar recibo
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">Obrigado! Guarde o recibo para suas contas.</p>
      </PublicShell>
    )
  }

  if (charge.status === 'AWAITING_CONFIRMATION' && avisar !== '1') {
    return (
      <PublicShell title="Aviso enviado">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold">Avisamos {landlord}</h2>
          <p className="text-sm text-muted-foreground">A confirmação é de {landlord}. O recibo chega neste mesmo link.</p>
        </div>
        <Card className="gap-4 p-4">
          <Step done title="Você avisou que pagou" detail={charge.reported_at ? whenLabel(charge.reported_at) : ''} />
          <Step title={`${landlord} confirma o pagamento`} detail="Aguardando" />
          <Step title="Recibo disponível" detail="Chega depois da confirmação" />
        </Card>
        <Button asChild variant="ghost" className="h-11 w-full">
          <Link href={`/p/${token}?avisar=1`}>Corrigir aviso</Link>
        </Button>
      </PublicShell>
    )
  }

  if ((open || charge.status === 'AWAITING_CONFIRMATION') && avisar === '1') {
    return (
      <PublicShell title="Já paguei">
        <LandlordLine name={charge.landlord_name} />
        <ReportForm token={token} today={todaySaoPaulo()} defaultAmount={charge.reported_amount ?? charge.amount} landlordFirstName={landlord} />
      </PublicShell>
    )
  }

  const pix = await loadPix(token)
  const late = charge.status === 'LATE'
  return (
    <PublicShell title="Sua cobrança">
      <LandlordLine name={charge.landlord_name} />
      <Summary charge={charge} />
      {late && (
        <div>
          <Badge variant="outline">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
            Atrasada
          </Badge>
          <p className="mt-2 text-xs text-muted-foreground">O valor inclui multa e juros até hoje.</p>
        </div>
      )}
      {pix ? (
        <PixPanel payload={pix.payload} qrSvg={pix.qrSvg} receiverName={pix.receiverName} />
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">O Pix não está disponível nesta cobrança. Fale com {landlord} para combinar o pagamento.</p>
        </Card>
      )}
      <Button asChild className="h-11 w-full">
        <Link href={`/p/${token}?avisar=1`}>Já paguei</Link>
      </Button>
      <p className="text-center text-xs text-muted-foreground">Você paga pelo seu banco. O ImoviFlow não recebe nem guarda seu dinheiro.</p>
    </PublicShell>
  )
}

function Step({ title, detail, done }: { title: string; detail: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className={done ? 'text-success' : 'text-muted-foreground'}>
        {done ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />}
      </span>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{detail}</div>
      </div>
    </div>
  )
}
