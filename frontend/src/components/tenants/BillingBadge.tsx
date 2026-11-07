import { Badge } from '@/components/ui/badge'
import type { BillingStatus } from '@/lib/tenant-overview'

/** `UNAVAILABLE` = os dados de cobrança não carregaram (aparece como "—", sem afirmar nada). */
export type BillingDisplay = BillingStatus | 'UNAVAILABLE'

const LABEL: Record<'LATE' | 'PAID' | 'PENDING', { text: string; dot: string }> = {
  LATE: { text: 'Atrasado', dot: 'bg-destructive' },
  PAID: { text: 'Pago', dot: 'bg-success' },
  PENDING: { text: 'Previsto', dot: 'bg-muted-foreground' },
}

export function BillingBadge({ status }: { status: BillingDisplay }) {
  if (status !== 'LATE' && status !== 'PAID' && status !== 'PENDING') {
    return <span className="text-muted-foreground">—</span>
  }
  const { text, dot } = LABEL[status]
  return (
    <Badge variant="outline">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {text}
    </Badge>
  )
}
