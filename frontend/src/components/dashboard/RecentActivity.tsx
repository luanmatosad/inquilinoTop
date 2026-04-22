import { Card } from '@heroui/react'
import { Receipt, AlertCircle } from 'lucide-react'

interface RecentActivityProps {
  payments: Array<{
    id: string
    description: string
    amount: number
    due_date: string
    status: string
    tenantName?: string
  }>
  expiringLeases: Array<{
    id: string
    unitLabel: string
    tenantName: string
    endDate: string
  }>
}

export function RecentActivity({ payments, expiringLeases }: RecentActivityProps) {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDate = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Hoje'
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <Card className="p-4">
      <h2 className="text-xl font-semibold text-on-surface mb-4">Atividades Recentes</h2>
      
      <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-2">
        {payments.slice(0, 3).map((payment) => (
          <div 
            key={payment.id}
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-on-surface block">
                Pagamento Recebido
              </span>
              <span className="text-xs text-tertiary truncate block">
                {payment.description || 'Aluguel'} ({formatCurrency(payment.amount)})
              </span>
            </div>
            <span className="text-xs text-outline shrink-0">
              {formatDate(payment.due_date)}
            </span>
          </div>
        ))}

        {expiringLeases.slice(0, 2).map((lease) => (
          <div 
            key={lease.id}
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-on-surface block">
                Contrato Expirando
              </span>
              <span className="text-xs text-tertiary truncate block">
                {lease.unitLabel} (em {formatDate(lease.endDate)})
              </span>
            </div>
            <span className="text-xs text-outline shrink-0">
              {formatDate(lease.endDate)}
            </span>
          </div>
        ))}
      </div>

      <button className="w-full py-2 mt-4 border border-outline-variant rounded-lg text-sm font-medium text-on-surface hover:bg-surface transition-colors">
        Ver todo histórico
      </button>
    </Card>
  )
}