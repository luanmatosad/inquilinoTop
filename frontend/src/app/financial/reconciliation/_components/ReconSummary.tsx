import { Check, TrendingUp, AlertTriangle, ArrowLeftRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { fmtBRL } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ReconCounts {
  total: number
  matched: number
  suggested: number
  unmatched: number
  manual: number
}

interface SummaryCardProps {
  label: string
  value: string
  sub: string
  tone: 'success' | 'warning' | 'error' | 'info'
  icon: React.ComponentType<{ className?: string }>
}

const TONE_STYLES = {
  success: { icon: 'text-[#15803d] bg-[#d1fadf]', value: 'text-[#15803d]' },
  warning: { icon: 'text-[#b45309] bg-[#fff0c2]', value: 'text-[#b45309]' },
  error:   { icon: 'text-[#7f1010] bg-[#fee2e2]', value: 'text-[#7f1010]' },
  info:    { icon: 'text-[#00366f] bg-[#dbe7ff]', value: 'text-on-surface' },
}

function SummaryCard({ label, value, sub, tone, icon: Icon }: SummaryCardProps) {
  const s = TONE_STYLES[tone]
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{label}</p>
        <div className={cn('grid place-items-center rounded-[8px] size-7', s.icon)}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <p className={cn('text-[22px] font-bold tabular-nums leading-none', s.value)}>{value}</p>
      <p className="text-[12px] text-on-surface-variant">{sub}</p>
    </Card>
  )
}

interface ReconSummaryProps {
  counts: ReconCounts
  netInflow: number
  totalIn: number
  totalOut: number
}

export function ReconSummary({ counts, netInflow, totalIn, totalOut }: ReconSummaryProps) {
  const pct = counts.total > 0 ? Math.round((counts.matched / counts.total) * 100) : 0

  return (
    <div className="grid grid-cols-4 gap-4">
      <SummaryCard
        label="Conciliadas"
        value={`${counts.matched}/${counts.total}`}
        sub={`${pct}% do extrato`}
        tone="success"
        icon={Check}
      />
      <SummaryCard
        label="Sugestões"
        value={String(counts.suggested)}
        sub="Aguardando aprovação"
        tone="warning"
        icon={TrendingUp}
      />
      <SummaryCard
        label="Sem match"
        value={String(counts.unmatched)}
        sub="Precisam de ação manual"
        tone="error"
        icon={AlertTriangle}
      />
      <SummaryCard
        label="Entradas (líq.)"
        value={fmtBRL(netInflow)}
        sub={`${fmtBRL(totalIn)} − ${fmtBRL(Math.abs(totalOut))}`}
        tone="info"
        icon={ArrowLeftRight}
      />
    </div>
  )
}
