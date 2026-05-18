'use client'

import { Check, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtBRL } from '@/lib/format'

interface BulkActionBarProps {
  selected: Set<string>
  pendingIds: string[]
  approvedIds: string[]
  pendingTotal: number
  approvedTotal: number
  onApprove: (ids: string[]) => void
  onPay: (ids: string[]) => void
  onClear: () => void
}

export function BulkActionBar({
  selected, pendingIds, approvedIds,
  pendingTotal, approvedTotal,
  onApprove, onPay, onClear,
}: BulkActionBarProps) {
  if (selected.size === 0) return null

  const n = selected.size
  const hasPending = pendingIds.length > 0
  const hasApproved = approvedIds.length > 0

  return (
    <div
      className="flex items-center gap-4 rounded-md border px-4 py-3"
      style={{
        borderColor: 'var(--primary)',
        boxShadow: '0 0 0 2px rgba(0,87,190,.12)',
      }}
    >
      <span className="text-[13px] font-semibold text-primary">
        {n} selecionada{n !== 1 ? 's' : ''}
      </span>

      <div className="h-[22px] w-px bg-border" />

      <div className="flex gap-3 text-[12.5px] text-on-surface-variant">
        {hasPending && (
          <span>{pendingIds.length} pendente{pendingIds.length !== 1 ? 's' : ''} · {fmtBRL(pendingTotal)}</span>
        )}
        {hasPending && hasApproved && <span>·</span>}
        {hasApproved && (
          <span>{approvedIds.length} aprovada{approvedIds.length !== 1 ? 's' : ''} · {fmtBRL(approvedTotal)}</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {hasPending && (
          <Button size="sm" variant="outline" onClick={() => onApprove(pendingIds)}>
            <Check className="mr-1.5 size-3.5" />
            Aprovar {pendingIds.length} pendente{pendingIds.length !== 1 ? 's' : ''}
          </Button>
        )}
        {hasApproved && (
          <Button size="sm" onClick={() => onPay(approvedIds)}>
            <Send className="mr-1.5 size-3.5" />
            Pagar {approvedIds.length} aprovada{approvedIds.length !== 1 ? 's' : ''}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="size-8 p-0" onClick={onClear}>
          <X className="size-4" />
          <span className="sr-only">Limpar seleção</span>
        </Button>
      </div>
    </div>
  )
}
