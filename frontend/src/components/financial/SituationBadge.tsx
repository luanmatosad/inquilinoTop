import { Badge } from '@/components/ui/badge'
import type { Situation } from '@/lib/financial-overview'

const DOT: Record<Situation, string> = { LATE: 'bg-destructive', PAID: 'bg-success', PENDING: 'bg-muted-foreground', AWAITING: 'bg-warning' }

export function SituationBadge({ situation, labels }: { situation: Situation; labels: Partial<Record<Situation, string>> }) {
  return (
    <Badge variant="outline">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[situation]}`} />
      {labels[situation] ?? ''}
    </Badge>
  )
}
