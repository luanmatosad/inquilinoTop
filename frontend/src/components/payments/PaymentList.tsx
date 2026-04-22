'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Check, Clock } from 'lucide-react'
import { markAsPaid, markAsPending } from '@/app/payments/actions'
import { toast } from 'sonner'

export interface Payment {
  id: string
  description: string
  amount: number
  due_date: string
  status: string // 'PENDING' | 'PAID' | 'LATE'
  paid_at?: string | null
  type: string
}

interface PaymentListProps {
  payments: Payment[]
  leaseId: string
}

export function PaymentList({ payments, leaseId }: PaymentListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleMarkAsPaid = async (id: string) => {
    setLoadingId(id)
    try {
      const result = await markAsPaid(id, leaseId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Pagamento marcado como pago!')
      }
    } catch (error) {
      toast.error('Erro ao processar.')
    } finally {
      setLoadingId(null)
    }
  }

  const handleMarkAsPending = async (id: string) => {
      setLoadingId(id)
      try {
        const result = await markAsPending(id, leaseId)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Pagamento reaberto (pendente)!')
        }
      } catch (error) {
        toast.error('Erro ao processar.')
      } finally {
        setLoadingId(null)
      }
    }

  const getStatusBadge = (status: string, dueDate: string) => {
    if (status === 'PAID') {
      return <Badge className="bg-green-600 hover:bg-green-700">Pago</Badge>
    }
    
    const isLate = new Date(dueDate) < new Date() && status === 'PENDING'
    
    if (isLate) {
      return <Badge variant="destructive">Atrasado</Badge>
    }
    
    return <Badge variant="secondary">Pendente</Badge>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vencimento</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Nenhum pagamento registrado para este contrato.
              </TableCell>
            </TableRow>
          ) : (
            payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>
                  {new Date(payment.due_date).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="font-medium">{payment.description}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(payment.status, payment.due_date)}
                  {payment.paid_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(payment.paid_at).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" disabled={loadingId === payment.id}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {payment.status !== 'PAID' && (
                        <DropdownMenuItem onClick={() => handleMarkAsPaid(payment.id)}>
                          <Check className="mr-2 h-4 w-4 text-green-600" /> Marcar como Pago
                        </DropdownMenuItem>
                      )}
                      {payment.status === 'PAID' && (
                        <DropdownMenuItem onClick={() => handleMarkAsPending(payment.id)}>
                            <Clock className="mr-2 h-4 w-4" /> Reabrir (Pendente)
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
