import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react'

interface FinancialSummaryProps {
  revenue: {
    total: number
    paid: number
    pending: number
    overdue: number
  }
}

export function FinancialSummary({ revenue }: FinancialSummaryProps) {
  const percentPaid = revenue.total > 0 ? (revenue.paid / revenue.total) * 100 : 0

  return (
    <Card className="col-span-4 lg:col-span-2">
      <CardHeader>
        <CardTitle>Resumo Financeiro (Mês Atual)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          <div className="flex items-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4 space-y-1">
              <p className="text-sm font-medium leading-none text-muted-foreground">Total Esperado</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revenue.total)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col space-y-1 border-l-4 border-green-500 pl-4">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Recebido
              </span>
              <span className="text-lg font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revenue.paid)}
              </span>
              <span className="text-xs text-muted-foreground">{percentPaid.toFixed(0)}% do total</span>
            </div>

            <div className="flex flex-col space-y-1 border-l-4 border-yellow-500 pl-4">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Pendente
              </span>
              <span className="text-lg font-bold text-yellow-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revenue.pending)}
              </span>
            </div>

            <div className="flex flex-col space-y-1 border-l-4 border-red-500 pl-4">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Atrasado
              </span>
              <span className="text-lg font-bold text-red-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revenue.overdue)}
              </span>
            </div>
          </div>

          <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
            <div 
              className="bg-green-500 h-full transition-all" 
              style={{ width: `${percentPaid}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
