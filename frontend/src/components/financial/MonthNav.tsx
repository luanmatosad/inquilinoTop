import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatMonthLabel, shiftMonth } from '@/lib/financial-overview'

/** Navegação por mês; mantém `?situacao=` ao trocar. */
export function MonthNav({ basePath, ym, situacao }: { basePath: string; ym: string; situacao?: string }) {
  const href = (m: string) => {
    const params = new URLSearchParams({ mes: m })
    if (situacao) params.set('situacao', situacao)
    return `${basePath}?${params.toString()}`
  }
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon" aria-label="Mês anterior">
        <Link href={href(shiftMonth(ym, -1))} aria-label="Mês anterior">
          <ChevronLeft aria-hidden="true" />
        </Link>
      </Button>
      <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
        {formatMonthLabel(ym)}
      </span>
      <Button asChild variant="outline" size="icon" aria-label="Próximo mês">
        <Link href={href(shiftMonth(ym, 1))} aria-label="Próximo mês">
          <ChevronRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  )
}
