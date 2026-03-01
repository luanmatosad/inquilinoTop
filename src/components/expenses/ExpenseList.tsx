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
import { Check, Trash2 } from 'lucide-react'
import { markExpenseAsPaid, deleteExpense } from '@/app/expenses/actions'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useRouter } from 'next/navigation'

interface Expense {
  id: string
  description: string
  category: string
  amount: number
  due_date: string
  status: string
  paid_at?: string | null
}

interface ExpenseListProps {
  expenses: Expense[]
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICITY: 'Energia',
  WATER: 'Água',
  CONDO: 'Condomínio',
  TAX: 'Impostos',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outros',
}

export function ExpenseList({ expenses }: ExpenseListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  const handleMarkAsPaid = async (id: string) => {
    setLoadingId(id)
    try {
      const result = await markExpenseAsPaid(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Despesa marcada como paga!')
        router.refresh()
      }
    } catch (error) {
      toast.error('Erro ao processar.')
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const result = await deleteExpense(deletingId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Despesa excluída!')
        setDeletingId(null)
        router.refresh()
      }
    } catch (error) {
      toast.error('Erro ao excluir.')
    }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vencimento</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                Nenhuma despesa registrada.
              </TableCell>
            </TableRow>
          ) : (
            expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  {new Date(expense.due_date).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{CATEGORY_LABELS[expense.category] || expense.category}</Badge>
                </TableCell>
                <TableCell className="font-medium">{expense.description}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expense.amount)}
                </TableCell>
                <TableCell>
                  {expense.status === 'PAID' ? (
                    <Badge className="bg-green-600 hover:bg-green-700">Pago</Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {expense.status !== 'PAID' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Marcar como Pago"
                      onClick={() => handleMarkAsPaid(expense.id)}
                      disabled={loadingId === expense.id}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir"
                    onClick={() => setDeletingId(expense.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
