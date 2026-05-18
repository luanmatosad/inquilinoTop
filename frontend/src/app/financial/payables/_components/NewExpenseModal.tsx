'use client'

import * as React from 'react'
import { useActionState, useState } from 'react'
import { AlertTriangle, Check, ArrowLeftRight } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/financial/shared'
import { showToast } from '@/lib/sonner'
import { createExpense } from '../../actions'
import { PAYABLE_CATEGORY_LABELS } from '../../constants'
import type { CreateExpenseResult } from '../../actions'
import { fmtBRL, fmtDate } from '@/lib/format'

const INITIAL_STATE: CreateExpenseResult = { ok: true }

const METHODS = ['PIX', 'Boleto', 'Cartão', 'TED'] as const

const MINUS = '−'

interface NewExpenseModalProps {
  open: boolean
  onClose: () => void
}

export function NewExpenseModal({ open, onClose }: NewExpenseModalProps) {
  const [state, formAction, isPending] = useActionState(createExpense, INITIAL_STATE)

  const [category, setCategory] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [method, setMethod] = useState<'PIX' | 'Boleto' | 'Cartão' | 'TED'>('PIX')
  const [supplier, setSupplier] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [reimburseToOwner, setReimburseToOwner] = useState(true)

  const fieldErrors =
    state.ok === false && state.kind === 'validation' ? state.fieldErrors : {}
  const serverError = state.ok === false && state.kind === 'server' ? state : null

  const prevStateRef = React.useRef<typeof state>(INITIAL_STATE)
  React.useEffect(() => {
    if (state === prevStateRef.current) return
    prevStateRef.current = state
    if (state.ok === true) {
      showToast.success('Despesa registrada com sucesso.')
      onClose()
    } else if (!state.ok && state.kind === 'server') {
      showToast.error('Falha ao registrar despesa. Tente novamente.')
    }
  }, [state, onClose])

  // Reset form when modal opens
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setCategory('')
      setPropertyId('')
      setMethod('PIX')
      setSupplier('')
      setAmount('')
      setDueDate('')
      setReimburseToOwner(true)
    } else if (!isPending) {
      onClose()
    }
  }

  const categoryLabel = category
    ? PAYABLE_CATEGORY_LABELS[category as keyof typeof PAYABLE_CATEGORY_LABELS]
    : ''
  const amountNum = parseFloat(amount) || 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[720px]"
        onPointerDownOutside={(e) => { if (isPending) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (isPending) e.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle>Nova despesa</DialogTitle>
        </DialogHeader>

        {serverError && (
          <div
            className="flex items-start gap-2 rounded-lg border px-3 py-2.5"
            style={{ background: '#fee2e2', borderColor: 'rgba(186,26,26,.25)', color: '#7f1010', marginBottom: 14 }}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">Não foi possível registrar a despesa.</span>{' '}
              {serverError.httpStatus > 0 && (
                <>O serviço financeiro retornou erro <span className="font-mono">{serverError.httpStatus}</span>.{' '}</>
              )}
              Tente novamente em alguns instantes.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_240px]">
          {/* ─── Left: form ────────────────────────────────────────── */}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="method" value={method} />
            <input type="hidden" name="reimburseToOwner" value={String(reimburseToOwner)} />

            {/* Categoria + Imóvel */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className={fieldErrors?.category ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYABLE_CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors?.category && (
                  <p className="text-[11px] text-destructive">{fieldErrors.category}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Imóvel relacionado</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger className={fieldErrors?.propertyId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="00000000-0000-0000-0000-000000000001">Ap. 201 — Ed. Beira Mar</SelectItem>
                    <SelectItem value="00000000-0000-0000-0000-000000000002">Ap. 304 — Res. Alfa</SelectItem>
                    <SelectItem value="00000000-0000-0000-0000-000000000003">Casa 1 — Jd. América</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors?.propertyId && (
                  <p className="text-[11px] text-destructive">{fieldErrors.propertyId}</p>
                )}
              </div>
            </div>

            {/* Fornecedor */}
            <div className="space-y-1.5">
              <Label htmlFor="supplier">Fornecedor / beneficiário</Label>
              <Input
                id="supplier"
                name="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nome da empresa ou pessoa"
                className={fieldErrors?.supplier ? 'border-destructive' : ''}
              />
              {fieldErrors?.supplier && (
                <p className="text-[11px] text-destructive">{fieldErrors.supplier}</p>
              )}
            </div>

            {/* Vencimento + Valor + Forma */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dueDate">Vencimento</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={fieldErrors?.dueDate ? 'border-destructive' : ''}
                />
                {fieldErrors?.dueDate && (
                  <p className="text-[11px] text-destructive">{fieldErrors.dueDate}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={fieldErrors?.amount ? 'border-destructive' : ''}
                />
                {fieldErrors?.amount && (
                  <p className="text-[11px] text-destructive">{fieldErrors.amount}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Forma</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Descrição{' '}
                {!fieldErrors?.description && (
                  <span className="font-normal text-on-surface-variant">(opcional)</span>
                )}
              </Label>
              <Input
                id="description"
                name="description"
                placeholder="Referência, número da OS…"
                maxLength={120}
                className={fieldErrors?.description ? 'border-destructive' : ''}
              />
              {fieldErrors?.description && (
                <p className="text-[11px] text-destructive">{fieldErrors.description}</p>
              )}
            </div>

            {/* Toggle reimburse */}
            <button
              type="button"
              onClick={() => setReimburseToOwner(!reimburseToOwner)}
              className="w-full rounded-lg border border-border bg-surface-container-low p-2.5 text-left transition-colors hover:bg-surface-container"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-on-surface">Repassar custo ao proprietário</p>
                  <p className="text-[12px] text-on-surface-variant">
                    {reimburseToOwner
                      ? 'Esta despesa será deduzida do próximo repasse mensal.'
                      : 'Esta despesa fica como custo operacional da imobiliária.'}
                  </p>
                </div>
                {/* Pill toggle */}
                <div
                  className="relative inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full transition-colors"
                  style={{ background: reimburseToOwner ? 'var(--primary)' : 'var(--surface-variant)' }}
                >
                  <span
                    className="absolute h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform"
                    style={{ transform: reimburseToOwner ? 'translateX(15px)' : 'translateX(2px)' }}
                  />
                </div>
              </div>
            </button>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !category || !propertyId || !supplier}>
                {isPending ? (
                  <><Spinner /> Registrando…</>
                ) : (
                  <><Check className="size-3.5" /> Registrar despesa</>
                )}
              </Button>
            </DialogFooter>
          </form>

          {/* ─── Right: preview ──────────────────────────────────── */}
          <div
            className="hidden sm:block rounded-[10px] border border-border p-3.5 self-start"
            style={{ background: 'var(--surface-variant)' }}
          >
            <p className="text-[12px] font-semibold uppercase tracking-widest text-on-surface-variant mb-3">
              Resumo
            </p>
            <div className="rounded-lg bg-card border border-border p-3 space-y-2">
              {categoryLabel && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  {categoryLabel}
                </p>
              )}
              <p className="text-[12.5px] text-on-surface">{supplier || <span className="text-on-surface-variant italic">Fornecedor</span>}</p>
              <p className="text-[12.5px] text-on-surface-variant">{propertyId ? 'Imóvel selecionado' : <span className="italic">Imóvel relacionado</span>}</p>
              <div className="h-px bg-border" />
              <div className="flex items-end justify-between">
                <p className="text-[12px] text-on-surface-variant">
                  {dueDate ? `Vence ${fmtDate(dueDate)}` : 'Vencimento'}
                </p>
                <p
                  className="text-[18px] font-bold tabular-nums text-destructive"
                >
                  {amountNum > 0 ? `${MINUS}${fmtBRL(amountNum)}` : '—'}
                </p>
              </div>
            </div>

            {reimburseToOwner && amountNum > 0 && (
              <div
                className="mt-3 flex items-start gap-2 rounded-md px-2.5 py-2"
                style={{ background: 'color-mix(in srgb, var(--primary) 6%, transparent)' }}
              >
                <ArrowLeftRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <p className="text-[12px] text-on-surface">
                  Repasse mensal será reduzido em {fmtBRL(amountNum)}.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
