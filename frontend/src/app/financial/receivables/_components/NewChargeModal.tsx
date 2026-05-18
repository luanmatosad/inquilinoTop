'use client'

import * as React from 'react'
import { useActionState, useEffect, useState } from 'react'
import { AlertTriangle, Send } from 'lucide-react'
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
import { Spinner } from '@/components/financial/shared'
import { showToast } from '@/lib/sonner'
import { createPayment } from '../../actions'
import type { ActiveLease, CreatePaymentResult } from '../../actions'

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

const INITIAL_STATE: CreatePaymentResult = { ok: true }

export function NewChargeModal({ open, onClose, leases }: NewChargeModalProps) {
  const [state, formAction, isPending] = useActionState(
    createPayment,
    INITIAL_STATE,
  )
  const [leaseId, setLeaseId] = useState('')
  const [type, setType] = useState('')

  const fieldErrors =
    state.ok === false && state.kind === 'validation' ? state.fieldErrors : {}

  const serverError =
    state.ok === false && state.kind === 'server' ? state : null

  // React to action result after each submission.
  const prevStateRef = React.useRef<typeof state>(INITIAL_STATE)
  useEffect(() => {
    if (state === prevStateRef.current) return
    prevStateRef.current = state
    if (state.ok === true) {
      showToast.success('Cobrança gerada e enviada ao inquilino.')
      onClose()
    } else if (!state.ok && state.kind === 'server') {
      showToast.error('Falha ao gerar cobrança. Tente novamente.')
    }
  }, [state, onClose])

  const blockClose = isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setLeaseId('')
          setType('')
        } else if (!blockClose) {
          onClose()
        }
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => {
          if (blockClose) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (blockClose) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
        </DialogHeader>

        {/* ─── Server error banner ───────────────────────────────── */}
        {serverError && (
          <div
            className="flex items-start gap-2 rounded-lg border px-3 py-2.5"
            style={{
              background: '#fee2e2',
              borderColor: 'rgba(186,26,26,.25)',
              color: '#7f1010',
              marginBottom: '14px',
            }}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="text-sm leading-relaxed">
              <span className="font-semibold">Não foi possível gerar a cobrança.</span>{' '}
              {serverError.httpStatus > 0 && (
                <>
                  O serviço financeiro retornou erro{' '}
                  <span className="font-mono">{serverError.httpStatus}</span>.{' '}
                </>
              )}
              Tente novamente em alguns instantes.
            </div>
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="leaseId" value={leaseId} />
          <input type="hidden" name="type" value={type} />

          {/* Contrato */}
          <div className="space-y-1.5">
            <Label>Contrato</Label>
            <Select value={leaseId} onValueChange={setLeaseId}>
              <SelectTrigger
                className={fieldErrors?.leaseId ? 'border-destructive' : ''}
              >
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
            {fieldErrors?.leaseId && (
              <p className="text-[11px] text-destructive">{fieldErrors.leaseId}</p>
            )}
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger
                className={fieldErrors?.type ? 'border-destructive' : ''}
              >
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
            {fieldErrors?.type && (
              <p className="text-[11px] text-destructive">{fieldErrors.type}</p>
            )}
          </div>

          {/* Vencimento + Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                className={fieldErrors?.dueDate ? 'border-destructive' : ''}
              />
              {fieldErrors?.dueDate && (
                <p className="text-[11px] text-destructive">{fieldErrors.dueDate}</p>
              )}
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
                className={fieldErrors?.grossAmount ? 'border-destructive' : ''}
              />
              {fieldErrors?.grossAmount && (
                <p className="text-[11px] text-destructive">
                  {fieldErrors.grossAmount}
                </p>
              )}
            </div>
          </div>

          {/* Competência */}
          <div className="space-y-1.5">
            <Label htmlFor="competency">
              Competência{' '}
              {!fieldErrors?.competency && (
                <span className="font-normal text-on-surface-variant">(opcional)</span>
              )}
            </Label>
            <Input
              id="competency"
              name="competency"
              type="month"
              className={fieldErrors?.competency ? 'border-destructive' : ''}
            />
            {fieldErrors?.competency && (
              <p className="text-[11px] text-destructive">{fieldErrors.competency}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="description">
              Descrição{' '}
              {!fieldErrors?.description && (
                <span className="font-normal text-on-surface-variant">(opcional)</span>
              )}
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Observações sobre a cobrança..."
              rows={3}
              maxLength={120}
              className={fieldErrors?.description ? 'border-destructive' : ''}
            />
            {fieldErrors?.description && (
              <p className="text-[11px] text-destructive">
                {fieldErrors.description}
              </p>
            )}
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
              {isPending ? (
                <>
                  <Spinner />
                  Enviando…
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Gerar e enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
