import { FileText, Check, Send, Percent } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { fmtBRL } from '@/lib/format'
import { cn } from '@/lib/utils'

const TONE_STYLES = {
  warning: { icon: 'text-[#b45309] bg-[#fff0c2]', value: 'text-[#b45309]' },
  info:    { icon: 'text-[#00366f] bg-[#dbe7ff]', value: 'text-on-surface' },
  success: { icon: 'text-[#15803d] bg-[#d1fadf]', value: 'text-[#15803d]' },
  neutral: { icon: 'text-on-surface-variant bg-surface-container', value: 'text-on-surface' },
}

function Card4({ label, value, sub, tone, icon: Icon }: {
  label: string; value: string; sub: string
  tone: 'warning' | 'info' | 'success' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
}) {
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
      <p className="text-[12px] text-on-surface-variant leading-relaxed">{sub}</p>
    </Card>
  )
}

interface CommissionsSummaryProps {
  pending: number
  approved: number
  paid: number
  irrf: number
}

export function CommissionsSummary({ pending, approved, paid, irrf }: CommissionsSummaryProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card4 label="Pendente" value={fmtBRL(pending)} sub="Aguardando aprovação do gestor." tone="warning" icon={FileText} />
      <Card4 label="Aprovada" value={fmtBRL(approved)} sub="Pronta para pagamento ao corretor." tone="info" icon={Check} />
      <Card4 label="Paga no mês" value={fmtBRL(paid)} sub="Lançadas como despesa em Contas a pagar." tone="success" icon={Send} />
      <Card4 label="Retenção IRRF" value={fmtBRL(irrf)} sub="Retido na fonte de autônomos." tone="neutral" icon={Percent} />
    </div>
  )
}
