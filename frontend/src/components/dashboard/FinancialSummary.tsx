import { Card } from '@heroui/react'

interface FinancialSummaryProps {
  revenue: {
    total: number
    paid: number
    pending: number
    overdue: number
  }
}

export function FinancialSummary({ revenue }: FinancialSummaryProps) {
  const receivedPct = revenue.total > 0 ? (revenue.paid / revenue.total) * 100 : 0
  const pendingPct = revenue.total > 0 ? (revenue.pending / revenue.total) * 100 : 0
  const latePct = revenue.total > 0 ? (revenue.overdue / revenue.total) * 100 : 0

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-on-surface">Resumo Financeiro</h2>
        <button className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
          Ver relatório detalhado
        </button>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-4 bg-surface-container rounded-full overflow-hidden flex mb-4">
        <div 
          className="bg-primary h-full transition-all duration-500" 
          style={{ width: `${receivedPct}%` }} 
          title="Recebida" 
        />
        <div 
          className="bg-secondary-container h-full transition-all duration-500" 
          style={{ width: `${pendingPct}%` }} 
          title="Pendente" 
        />
        <div 
          className="bg-error h-full transition-all duration-500" 
          style={{ width: `${latePct}%` }} 
          title="Atrasada" 
        />
      </div>

      {/* Values Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-outline">Prevista</span>
          <span className="text-xl font-semibold text-on-surface">
            {formatCurrency(revenue.total)}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-l border-surface-container pl-4">
          <span className="text-xs text-outline flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Recebida
          </span>
          <span className="text-xl font-semibold text-on-surface">
            {formatCurrency(revenue.paid)}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-l border-surface-container pl-4">
          <span className="text-xs text-outline flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary-container" />
            Pendente
          </span>
          <span className="text-xl font-semibold text-on-surface">
            {formatCurrency(revenue.pending)}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-l border-surface-container pl-4">
          <span className="text-xs text-error flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-error" />
            Atrasada
          </span>
          <span className="text-xl font-semibold text-error">
            {formatCurrency(revenue.overdue)}
          </span>
        </div>
      </div>
    </Card>
  )
}