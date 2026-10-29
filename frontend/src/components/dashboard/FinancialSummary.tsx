import Link from 'next/link'
import type { ComponentProps } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils'

interface FinancialSummaryProps {
  revenue: {
    total: number
    paid: number
    pending: number
    overdue: number
  }
}

type BadgeVariant = ComponentProps<typeof Badge>['variant']

export function FinancialSummary({ revenue }: FinancialSummaryProps) {
  const hasRevenue = revenue.total > 0
  const receivedPct = hasRevenue ? (revenue.paid / revenue.total) * 100 : 0

  const values: { label: string; value: number; variant: BadgeVariant; valueClassName?: string }[] = [
    { label: 'Prevista', value: revenue.total, variant: 'outline' },
    { label: 'Recebida', value: revenue.paid, variant: 'default' },
    { label: 'Pendente', value: revenue.pending, variant: 'secondary' },
    { label: 'Atrasada', value: revenue.overdue, variant: 'destructive', valueClassName: 'text-destructive' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo Financeiro</CardTitle>
        <CardAction>
          <Button variant="link" size="sm" asChild>
            <Link href="/financial/dashboard">Ver relatório detalhado</Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-6">
        {hasRevenue ? (
          <div className="space-y-2">
            <Progress value={receivedPct} aria-label="Percentual recebido" />
            <p className="text-xs text-muted-foreground">{Math.round(receivedPct)}% recebido</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum valor previsto neste mês.</p>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {values.map(({ label, value, variant, valueClassName }) => (
            <div key={label} className="flex flex-col gap-1">
              <Badge variant={variant} className="w-fit">
                {label}
              </Badge>
              <span className={`text-xl font-semibold text-foreground ${valueClassName ?? ''}`}>
                {formatCurrency(value)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
