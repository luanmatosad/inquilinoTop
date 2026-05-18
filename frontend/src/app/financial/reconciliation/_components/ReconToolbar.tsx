'use client'

import * as React from 'react'
import { Search, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/financial/shared'
import { showToast } from '@/lib/sonner'
import { batchConfirmRecon } from '../../actions'

const STATUS_OPTS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'SUGGESTED', label: 'Sugestões' },
  { value: 'UNMATCHED', label: 'Sem match' },
  { value: 'MATCHED', label: 'Conciliadas' },
  { value: 'MANUAL', label: 'Manuais' },
]

interface ReconToolbarProps {
  search: string
  onSearch: (v: string) => void
  status: string
  onStatus: (v: string) => void
  confidence: number
  onConfidence: (v: number) => void
  suggestionsAboveThreshold: number
  accountId: string
  onBatchSuccess: () => void
}

export function ReconToolbar({
  search, onSearch, status, onStatus,
  confidence, onConfidence,
  suggestionsAboveThreshold, accountId, onBatchSuccess,
}: ReconToolbarProps) {
  const [batching, setBatching] = React.useState(false)

  async function handleBatch() {
    setBatching(true)
    const res = await batchConfirmRecon(accountId, confidence / 100)
    if (res.ok) {
      const n = res.confirmed
      showToast.success(
        `${n} ${n === 1 ? 'sugestão confirmada' : 'sugestões confirmadas'} com confiança ≥ ${confidence}%.`
      )
      onBatchSuccess()
    }
    setBatching(false)
  }

  const batchLabel = suggestionsAboveThreshold === 1
    ? 'Aceitar 1 sugestão'
    : `Aceitar ${suggestionsAboveThreshold} sugestões`

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: search + status filter */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar por descrição, pagador ou item vinculado…"
              value={search}
              onChange={e => onSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-4 text-[13px] outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={status}
            onChange={e => onStatus(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary"
          >
            {STATUS_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Right: confidence slider + batch button */}
        <div className="flex items-center gap-3 rounded-[8px] border border-border bg-surface-container-low px-3 py-1.5">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10.5px] font-medium uppercase tracking-wide text-on-surface-variant">
              CONFIANÇA MÍNIMA
            </p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={70}
                max={99}
                value={confidence}
                onChange={e => onConfidence(Number(e.target.value))}
                className="w-[120px] accent-primary"
                aria-label="Confiança mínima para aprovação em lote"
                aria-valuetext={`≥ ${confidence} por cento`}
              />
              <span className="text-[13px] font-semibold tabular-nums text-on-surface min-w-[36px]">
                ≥ {confidence}%
              </span>
            </div>
          </div>
          <Button
            size="sm"
            disabled={suggestionsAboveThreshold === 0 || batching}
            onClick={handleBatch}
          >
            {batching ? (
              <Spinner className="mr-1.5" />
            ) : (
              <Check className="mr-1.5 size-3.5" />
            )}
            {batchLabel}
          </Button>
        </div>
      </div>
    </Card>
  )
}
