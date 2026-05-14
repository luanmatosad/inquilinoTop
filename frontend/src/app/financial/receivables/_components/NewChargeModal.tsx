'use client'

import * as React from 'react'
import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createPayment } from '../../actions'
import type { ActiveLease } from '../../actions'

interface NewChargeModalProps {
  open: boolean
  onClose: () => void
  leases: ActiveLease[]
}

const TYPES = [
  { value: 'RENT', label: 'Aluguel' },
  { value: 'DEPOSIT', label: 'Depósito' },
  { value: 'EXPENSE', label: 'Despesa' },
  { value: 'OTHER', label: 'Outro' },
] as const

export function NewChargeModal({ open, onClose, leases }: NewChargeModalProps) {
  const [state, formAction, isPending] = useActionState(
    createPayment,
    null as { ok: true } | { error: string } | null,
  )
  const [leaseId, setLeaseId] = useState('')
  const [type, setType] = useState('')

  useEffect(() => {
    if (!state) return
    if ('ok' in state && state.ok) {
      toast.success('Cobrança criada com sucesso!')
      setLeaseId('')
      setType('')
      onClose()
    } else if ('error' in state && state.error) {
      toast.error(state.error)
    }
  }, [state, onClose])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="leaseId" value={leaseId} />
          <input type="hidden" name="type" value={type} />

          <div className="space-y-1.5">
            <Label>Contrato</Label>
            <Select value={leaseId} onValueChange={setLeaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um contrato" />
              </SelectTrigger>
              <SelectContent>
                {leases.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Nenhum contrato ativo
                  </SelectItem>
                ) : (
                  leases.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input id="dueDate" name="dueDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grossAmount">Valor (R$)</Label>
              <Input
                id="grossAmount"
                name="grossAmount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="competency">
              Competência{' '}
              <span className="font-normal text-on-surface-variant">(opcional)</span>
            </Label>
            <Input id="competency" name="competency" type="month" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">
              Descrição{' '}
              <span className="font-normal text-on-surface-variant">(opcional)</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Observações sobre a cobrança..."
              rows={3}
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !leaseId || !type}>
              {isPending ? 'Criando...' : 'Criar cobrança'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
