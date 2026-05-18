'use client'

import * as React from 'react'
import { Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/financial/shared'
import { showToast } from '@/lib/sonner'
import { createFromLine } from '../../actions'
import { fmtBRL, fmtDate } from '@/lib/format'
import type { ReconLine } from '../../actions'

interface CreateFromLineModalProps {
  open: boolean
  onClose: () => void
  line: ReconLine | null
  onSuccess: () => void
}

type ModalState = 'idle' | 'submitting' | 'serverError'

export function CreateFromLineModal({ open, onClose, line, onSuccess }: CreateFromLineModalProps) {
  const [state, setState] = React.useState<ModalState>('idle')
  const [counterparty, setCounterparty] = React.useState('')
  const [property, setProperty] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [description, setDescription] = React.useState('')

  React.useEffect(() => {
    if (open && line) {
      setState('idle')
      setCounterparty(line.counterparty)
      setDescription(line.desc)
      setProperty('')
      setCategory('')
    }
  }, [open, line])

  if (!line) return null

  const isEntry = line.amount > 0
  const kind = isEntry ? ('receivable' as const) : ('payable' as const)
  const title = isEntry ? 'Criar cobrança a partir do extrato' : 'Criar despesa a partir do extrato'
  const categoryOptions = isEntry
    ? [{ value: 'RENT', label: 'Aluguel' }, { value: 'OTHER', label: 'Outro recebimento' }]
    : [
        { value: 'REPAIR_HYDRAULIC', label: 'Reparo hidráulico' },
        { value: 'REPAIR_ELECTRIC', label: 'Reparo elétrico' },
        { value: 'CLEAN', label: 'Limpeza' },
        { value: 'CONDO', label: 'Condomínio' },
        { value: 'IPTU', label: 'IPTU' },
        { value: 'TAX', label: 'Imposto' },
        { value: 'OTHER', label: 'Outro pagamento' },
      ]

  async function handleSubmit() {
    setState('submitting')
    const res = await createFromLine(line!.id, {
      kind,
      property,
      category,
      amount: Math.abs(line!.amount),
      counterparty,
      description,
    })
    if (res.ok) {
      showToast.success(`Item criado e vinculado à linha do extrato.`)
      onSuccess()
      onClose()
    } else {
      setState('serverError')
    }
  }

  const isSubmitting = state === 'submitting'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {state === 'serverError' && (
          <div className="rounded-md bg-[#fee2e2] border border-[#fecaca] px-4 py-3 text-[13px] text-[#7f1010]">
            Erro ao criar o item. Tente novamente.
          </div>
        )}

        <div className="space-y-4">
          {/* Line summary */}
          <div className="rounded-[8px] bg-surface-container-low border border-border px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[11.5px] tabular-nums text-on-surface-variant">{fmtDate(line.date)}</p>
              <p className="text-[13px] font-semibold font-mono text-on-surface mt-0.5">{line.desc}</p>
              <p className="text-[12px] text-on-surface-variant">{line.counterparty}</p>
            </div>
            <p className="text-[14px] font-bold tabular-nums text-on-surface">
              {fmtBRL(Math.abs(line.amount))}
            </p>
          </div>

          {/* Form */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-on-surface-variant">
                {isEntry ? 'Pagador' : 'Beneficiário'}
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={e => setCounterparty(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-on-surface-variant">Categoria</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              >
                <option value="">Selecione…</option>
                {categoryOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-on-surface-variant">Imóvel</label>
              <input
                type="text"
                placeholder="Ex: Ap. 101 Solar Ipanema"
                value={property}
                onChange={e => setProperty(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-on-surface-variant">Valor</label>
              <input
                type="text"
                value={fmtBRL(Math.abs(line.amount))}
                readOnly
                className="w-full rounded-md border border-border bg-surface-container px-3 py-2 text-[13px] tabular-nums text-on-surface-variant"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-[12px] font-medium text-on-surface-variant">Descrição interna</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              />
            </div>
          </div>

          {/* Info box */}
          <div className="flex gap-2.5 rounded-[8px] border border-[rgba(34,197,94,.2)] bg-[rgba(34,197,94,.06)] px-4 py-3">
            <Info className="mt-0.5 size-4 flex-shrink-0 text-[#15803d]" />
            <p className="text-[12px] text-[#15803d] leading-relaxed">
              O item será criado como <strong>PAGO</strong> (já {isEntry ? 'recebido' : 'pago'}) e vinculado automaticamente a esta linha do extrato.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !category}>
            {isSubmitting ? (
              <><Spinner className="mr-2" /> Salvando…</>
            ) : 'Criar e vincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
