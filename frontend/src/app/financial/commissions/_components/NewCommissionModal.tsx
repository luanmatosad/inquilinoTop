'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/financial/shared'
import { showToast } from '@/lib/sonner'
import { createCommission } from '../../actions'
import { calcCommission } from '../_lib/calc'
import { CommissionPreview } from './CommissionPreview'
import { cn } from '@/lib/utils'
import type { Broker, CommissionOperation } from '../../actions'

const DEFAULT_PCT: Record<CommissionOperation, number> = {
  LEASE: 1,
  SALE: 0.06,
  CAPTURE: 0.20,
}

const OP_TABS: { id: CommissionOperation; label: string }[] = [
  { id: 'LEASE', label: 'Locação' },
  { id: 'SALE', label: 'Venda' },
  { id: 'CAPTURE', label: 'Captação' },
]

interface NewCommissionModalProps {
  open: boolean
  onClose: () => void
  brokers: Broker[]
  onSuccess: () => void
}

type ModalState = 'idle' | 'submitting' | 'serverError'

interface FieldErrors {
  brokerId?: string
  base?: string
  pct?: string
}

export function NewCommissionModal({ open, onClose, brokers, onSuccess }: NewCommissionModalProps) {
  const [state, setState] = React.useState<ModalState>('idle')
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [operation, setOperation] = React.useState<CommissionOperation>('LEASE')
  const [brokerId, setBrokerId] = React.useState('')
  const [captureBrokerId, setCaptureBrokerId] = React.useState('')
  const [property, setProperty] = React.useState('')
  const [contractId, setContractId] = React.useState('')
  const [base, setBase] = React.useState('')
  const [pct, setPct] = React.useState(String(DEFAULT_PCT.LEASE))
  const [splitOperator, setSplitOperator] = React.useState(50)

  React.useEffect(() => {
    if (open) {
      setState('idle')
      setErrors({})
      setOperation('LEASE')
      setBrokerId('')
      setCaptureBrokerId('')
      setProperty('')
      setContractId('')
      setBase('')
      setPct(String(DEFAULT_PCT.LEASE))
      setSplitOperator(50)
    }
  }, [open])

  function handleOpChange(op: CommissionOperation) {
    setOperation(op)
    setPct(String(DEFAULT_PCT[op]))
  }

  const broker = brokers.find(b => b.id === brokerId) ?? null
  const captureBroker = captureBrokerId ? brokers.find(b => b.id === captureBrokerId) ?? null : null
  const hasSplit = captureBroker !== null && captureBrokerId !== brokerId

  const baseN = parseFloat(base) || 0
  const pctN = parseFloat(pct) || 0
  const irrfRate = broker?.regime === 'Autônomo' ? (broker.irrfDefault ?? 0) : 0
  const calc = calcCommission({ base: baseN, pct: pctN, splitOperator: hasSplit ? splitOperator : 100, irrfRate })

  function validate(): boolean {
    const errs: FieldErrors = {}
    if (!brokerId) errs.brokerId = 'Selecione o corretor responsável.'
    if (baseN <= 0) errs.base = 'Informe a base de cálculo.'
    if (pctN <= 0) errs.pct = 'Informe o percentual/multiplicador.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) { setState('idle'); return }
    setState('submitting')
    const res = await createCommission({
      operation,
      brokerId,
      captureBrokerId: captureBrokerId || undefined,
      splitOperator: hasSplit ? splitOperator : 100,
      property,
      contractId,
      base: baseN,
      pct: pctN,
    })
    if (res.ok) {
      showToast.success('Comissão registrada com sucesso.')
      onSuccess()
      onClose()
    } else {
      setState('serverError')
    }
  }

  const isSubmitting = state === 'submitting'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !isSubmitting) onClose() }}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Nova comissão</DialogTitle>
        </DialogHeader>

        {state === 'serverError' && (
          <div className="rounded-md bg-[#fee2e2] border border-[#fecaca] px-4 py-3 text-[13px] text-[#7f1010]">
            Erro ao registrar a comissão. Tente novamente.
          </div>
        )}

        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 240px' }}>
          {/* Main form */}
          <div className="space-y-5">
            {/* Operation type */}
            <div>
              <p className="text-[12px] font-medium text-on-surface-variant mb-2">Tipo de operação</p>
              <div className="grid grid-cols-3 gap-2">
                {OP_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleOpChange(tab.id)}
                    className={cn(
                      'rounded-[8px] border px-3 py-2 text-[13px] font-medium transition-colors',
                      operation === tab.id
                        ? 'border-primary bg-[rgba(0,87,190,.06)] text-primary'
                        : 'border-border text-on-surface hover:border-primary/40',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Broker + Capturer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-on-surface-variant">Corretor responsável *</label>
                <select
                  value={brokerId}
                  onChange={e => setBrokerId(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    'w-full rounded-md border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary disabled:opacity-60',
                    errors.brokerId ? 'border-destructive' : 'border-border',
                  )}
                >
                  <option value="">Selecionar corretor…</option>
                  {brokers.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.regime})</option>
                  ))}
                </select>
                {errors.brokerId && <p className="text-[11.5px] text-destructive">{errors.brokerId}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-on-surface-variant">Captador (opcional)</label>
                <select
                  value={captureBrokerId}
                  onChange={e => setCaptureBrokerId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                >
                  <option value="">Sem captador separado</option>
                  {brokers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Property + contract */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-on-surface-variant">Imóvel / contrato</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Ex: Apto 101 Solar Ipanema"
                  value={property}
                  onChange={e => setProperty(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                />
                <input
                  type="text"
                  placeholder="Ex: LSE-2026-411"
                  value={contractId}
                  onChange={e => setContractId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                />
              </div>
            </div>

            {/* Base + pct */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-on-surface-variant">Base de cálculo *</label>
                <input
                  type="number"
                  placeholder="0,00"
                  value={base}
                  onChange={e => setBase(e.target.value)}
                  disabled={isSubmitting}
                  min={0}
                  step={0.01}
                  className={cn(
                    'w-full rounded-md border bg-background px-3 py-2 text-[13px] tabular-nums outline-none focus:ring-2 focus:ring-primary disabled:opacity-60',
                    errors.base ? 'border-destructive' : 'border-border',
                  )}
                />
                {errors.base && <p className="text-[11.5px] text-destructive">{errors.base}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-on-surface-variant">% / multiplicador *</label>
                <input
                  type="number"
                  value={pct}
                  onChange={e => setPct(e.target.value)}
                  disabled={isSubmitting}
                  min={0}
                  step={0.01}
                  className={cn(
                    'w-full rounded-md border bg-background px-3 py-2 text-[13px] tabular-nums outline-none focus:ring-2 focus:ring-primary disabled:opacity-60',
                    errors.pct ? 'border-destructive' : 'border-border',
                  )}
                />
                {errors.pct && <p className="text-[11.5px] text-destructive">{errors.pct}</p>}
              </div>
            </div>

            {/* Split slider */}
            {hasSplit && (
              <div
                className="rounded-[10px] border p-3 space-y-2"
                style={{
                  background: 'rgba(0,87,190,.05)',
                  borderColor: 'rgba(0,87,190,.15)',
                }}
              >
                <div className="flex justify-between items-center">
                  <p className="text-[12px] font-medium text-on-surface-variant">Split entre operador e captador</p>
                  <p className="text-[12px] font-semibold tabular-nums text-primary">
                    {splitOperator}% / {100 - splitOperator}%
                  </p>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={splitOperator}
                  onChange={e => setSplitOperator(Number(e.target.value))}
                  className="w-full accent-primary"
                  aria-label="Percentual do operador"
                  aria-valuetext={`${splitOperator} por cento`}
                />
                <div className="flex justify-between text-[11px] text-on-surface-variant">
                  <span>{broker?.name.split(' ')[0] ?? 'Operador'}</span>
                  <span>{captureBroker?.name.split(' ')[0] ?? 'Captador'}</span>
                </div>
              </div>
            )}

            {/* IRRF banner */}
            {broker?.regime === 'Autônomo' && (
              <div
                className="flex gap-2.5 rounded-[8px] border px-4 py-3"
                style={{ background: 'rgba(186,26,26,.05)', borderColor: 'rgba(186,26,26,.15)' }}
              >
                <p className="text-[12px] text-[#7f1010] leading-relaxed">
                  <strong>{broker.name}</strong> é <strong>Autônomo</strong> — aplicamos retenção IRRF padrão de{' '}
                  <strong>{Math.round(broker.irrfDefault * 100)}%</strong>. Edite no cadastro do corretor se necessário.
                </p>
              </div>
            )}
            {broker?.regime === 'MEI' && (
              <div
                className="flex gap-2.5 rounded-[8px] border px-4 py-3"
                style={{ background: 'rgba(34,197,94,.06)', borderColor: 'rgba(34,197,94,.2)' }}
              >
                <p className="text-[12px] text-[#15803d] leading-relaxed">
                  <strong>{broker.name}</strong> é <strong>MEI</strong> — pagamento bruto, sem retenção. Corretor emite NF próprio.
                </p>
              </div>
            )}
          </div>

          {/* Preview panel */}
          <CommissionPreview
            broker={broker}
            captureBroker={hasSplit ? captureBroker : null}
            base={baseN}
            pct={pctN}
            splitOperator={hasSplit ? splitOperator : 100}
            grossOperator={calc.grossOperator}
            grossCapturer={calc.grossCapturer}
            irrf={calc.irrf}
            irrfRate={irrfRate}
            net={calc.net}
            operation={operation}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <><Spinner className="mr-2" /> Salvando…</>
            ) : (
              <><Plus className="mr-2 size-4" /> Registrar comissão</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
