import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowRight, AlertTriangle } from 'lucide-react'

interface RecentActivityProps {
  payments: {
    id: string
    description: string
    amount: number
    due_date: string
    status: string
    tenantName: string
  }[]
  expiringLeases: {
    id: string
    unitLabel: string
    tenantName: string
    endDate: string
  }[]
}

export function RecentActivity({ payments, expiringLeases }: RecentActivityProps) {
  return (
    <div className="col-span-4 lg:col-span-2 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pagamentos Recentes</CardTitle>
          <Link href="/properties" className="text-sm text-primary hover:underline flex items-center gap-1">
            Ver unidades <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento recente.</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{payment.description}</p>
                    <p className="text-xs text-muted-foreground">{payment.tenantName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-bold text-sm">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount)}
                    </span>
                    {payment.status === 'PAID' ? (
                      <Badge className="bg-green-600 h-5 text-[10px] text-white hover:bg-green-700">Pago</Badge>
                    ) : payment.status === 'LATE' ? (
                      <Badge variant="destructive" className="h-5 text-[10px]">Atrasado</Badge>
                    ) : (
                      <Badge variant="secondary" className="h-5 text-[10px]">Pendente</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {expiringLeases.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" /> Contratos Vencendo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expiringLeases.map((lease) => (
                <div key={lease.id} className="flex items-center justify-between border-b border-yellow-200 pb-2 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{lease.unitLabel}</p>
                    <p className="text-xs text-muted-foreground">{lease.tenantName}</p>
                  </div>
                  <div className="text-sm font-medium text-yellow-700">
                    Vence em {new Date(lease.endDate).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
