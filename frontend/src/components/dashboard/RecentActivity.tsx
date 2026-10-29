import Link from 'next/link'
import type { ComponentProps } from 'react'
import { AlertCircle, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { formatCurrency } from '@/lib/utils'

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

type BadgeVariant = ComponentProps<typeof Badge>['variant']

const PAYMENT_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  PAID: { label: 'Pago', variant: 'default' },
  PENDING: { label: 'Pendente', variant: 'secondary' },
  LATE: { label: 'Atrasado', variant: 'destructive' },
}

// due_date/end_date come as "YYYY-MM-DD"; parse as local date to avoid UTC off-by-one.
const parseLocalDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const formatDate = (date: string) => {
  const d = parseLocalDate(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function RecentActivity({ payments, expiringLeases }: RecentActivityProps) {
  const recentPayments = payments.slice(0, 3)
  const leases = expiringLeases.slice(0, 2)
  const hasActivity = recentPayments.length > 0 || leases.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividades Recentes</CardTitle>
      </CardHeader>

      <CardContent>
        {hasActivity ? (
          <ItemGroup className="gap-2">
            {recentPayments.map((payment) => {
              const status = PAYMENT_STATUS[payment.status]

              return (
                <Item key={payment.id} size="sm">
                  <ItemMedia variant="icon">
                    <Receipt />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{payment.description || 'Aluguel'}</ItemTitle>
                    <ItemDescription>
                      {[payment.tenantName, formatCurrency(payment.amount), formatDate(payment.due_date)]
                        .filter(Boolean)
                        .join(' · ')}
                    </ItemDescription>
                  </ItemContent>
                  <Badge variant={status?.variant ?? 'outline'}>{status?.label ?? payment.status}</Badge>
                </Item>
              )
            })}

            {leases.map((lease) => (
              <Item key={lease.id} size="sm">
                <ItemMedia variant="icon">
                  <AlertCircle />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Contrato expirando</ItemTitle>
                  <ItemDescription>
                    {[lease.unitLabel, lease.tenantName].filter(Boolean).join(' · ')}
                  </ItemDescription>
                </ItemContent>
                <Badge variant="secondary">Vence {formatDate(lease.endDate)}</Badge>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma atividade recente.</p>
        )}
      </CardContent>

      <CardFooter>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/payments">Ver todo histórico</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
