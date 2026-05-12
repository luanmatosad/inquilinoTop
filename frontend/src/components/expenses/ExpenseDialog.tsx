'use client'

import { useActionState, useEffect, useState, startTransition } from 'react'
import { createExpense } from '@/app/expenses/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const EXPENSE_CATEGORIES = [
  { value: 'ELECTRICITY', label: 'Energia Elétrica' },
  { value: 'WATER', label: 'Água / Esgoto' },
  { value: 'CONDO', label: 'Condomínio' },
  { value: 'TAX', label: 'IPTU / Taxas' },
  { value: 'MAINTENANCE', label: 'Manutenção' },
  { value: 'OTHER', label: 'Outros' },
]

interface Property {
  id: string
  name: string
  units: { id: string; label: string }[]
}

interface ExpenseDialogProps {
  unitId?: string
  properties?: Property[]
}

export function ExpenseDialog({ unitId, properties = [] }: ExpenseDialogProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createExpense, null)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success)
      startTransition(() => setOpen(false))
    }
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nova Despesa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Despesa</DialogTitle>
        </DialogHeader>
        
        <form action={formAction} className="space-y-4">
          {unitId ? (
            <input type="hidden" name="unit_id" value={unitId} />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Propriedade *</Label>
                <Select required value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_id">Unidade (Opcional)</Label>
                <Select name="unit_id" disabled={!selectedPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProperty?.units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select name="category" required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              name="description"
              placeholder="Ex: Conta de Luz Jan/2026"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Vencimento *</Label>
              <Input
                id="due_date"
                name="due_date"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input
              id="notes"
              name="notes"
              placeholder="Opcional"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
