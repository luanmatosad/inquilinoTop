'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, DollarSign, User, AlertCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { endLease, cancelLease } from '@/app/leases/actions'
import { toast } from 'sonner'
import { useState } from 'react'

interface Lease {
  id: string
  unit_id: string
  start_date: string
  end_date?: string | null
  rent_amount: number
  payment_day: number
  status: string
  notes?: string | null
  tenant: {
    name: string
    email?: string | null
    phone?: string | null
  }
}

interface ActiveLeaseCardProps {
  lease: Lease
}

export function ActiveLeaseCard({ lease }: ActiveLeaseCardProps) {
  const [isEnding, setIsEnding] = useState(false)

  const handleEndLease = async () => {
    try {
      const result = await endLease(lease.id, lease.unit_id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Contrato encerrado com sucesso!')
      }
    } catch (error) {
      toast.error('Erro ao encerrar contrato.')
    }
  }

  const handleCancelLease = async () => {
      try {
        const result = await cancelLease(lease.id, lease.unit_id)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Contrato cancelado com sucesso!')
        }
      } catch (error) {
        toast.error('Erro ao cancelar contrato.')
      }
    }

  return (
    <Card className="border-green-200 bg-green-50/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium text-green-800 flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5" />
          Contrato Ativo
        </CardTitle>
        <Badge className="bg-green-600 hover:bg-green-700">Em Vigência</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <User className="h-4 w-4" /> Inquilino
            </p>
            <p className="text-lg font-semibold">{lease.tenant.name}</p>
            <div className="text-sm text-muted-foreground">
              {lease.tenant.email && <div>{lease.tenant.email}</div>}
              {lease.tenant.phone && <div>{lease.tenant.phone}</div>}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Período
            </p>
            <div className="text-sm">
              <span className="font-semibold">Início:</span> {new Date(lease.start_date).toLocaleDateString('pt-BR')}
            </div>
            {lease.end_date && (
              <div className="text-sm">
                <span className="font-semibold">Fim:</span> {new Date(lease.end_date).toLocaleDateString('pt-BR')}
              </div>
            )}
            <div className="text-sm text-muted-foreground mt-1">
              Dia do Vencimento: <span className="font-semibold">{lease.payment_day}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Financeiro
            </p>
            <p className="text-2xl font-bold text-green-700">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lease.rent_amount)}
            </p>
            <p className="text-xs text-muted-foreground">Valor mensal do aluguel</p>
          </div>
        </div>

        {lease.notes && (
          <div className="mt-4 p-3 bg-white/50 rounded-md text-sm border border-green-100">
            <span className="font-semibold">Observações:</span> {lease.notes}
          </div>
        )}

        <div className="mt-6 flex gap-2 justify-end border-t pt-4 border-green-200">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">
                Cancelar Contrato (Erro)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar Contrato?</AlertDialogTitle>
                <AlertDialogDescription>
                  Use esta opção apenas se o contrato foi criado por engano. Isso irá marcar como CANCELADO e não gerará histórico financeiro válido.
                  Para encerrar um contrato que chegou ao fim, use &quot;Encerrar Contrato&quot;.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelLease} className="bg-red-600 hover:bg-red-700">
                  Confirmar Cancelamento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                Encerrar Contrato (Desocupação)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Encerrar Contrato?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso irá marcar o contrato como ENCERRADO na data de hoje. 
                  O imóvel ficará disponível para novos contratos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleEndLease}>
                  Confirmar Encerramento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
