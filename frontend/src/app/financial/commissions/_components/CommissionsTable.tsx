'use client'

import * as React from 'react'
import { MoreVertical } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fmtBRL, fmtPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionItem, CommissionStatus, Broker } from '../../actions'

const STATUS_META: Record<CommissionStatus, { badge: 'PENDING' | 'REVIEW' | 'PAID'; label: string }> = {
  PENDING:  { badge: 'PENDING', label: 'Pendente' },
  APPROVED: { badge: 'REVIEW',  label: 'Aprovada' },
  PAID:     { badge: 'PAID',    label: 'Paga' },
}

const OP_LABEL: Record<string, string> = {
  LEASE: 'Locação',
  SALE: 'Venda',
  CAPTURE: 'Captação',
}

function brokerInitials(name: string) {
  return name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

function getMenuItems(status: CommissionStatus) {
  const items: Array<{ label: string; action: string; variant?: 'danger' | 'primary'; separator?: boolean }> = []
  if (status === 'PENDING') {
    items.push({ label: 'Aprovar comissão', action: 'approve', variant: 'primary' })
    items.push({ label: 'Editar valor / %', action: 'edit' })
    items.push({ label: 'Recusar', action: 'reject', variant: 'danger', separator: true })
  } else if (status === 'APPROVED') {
    items.push({ label: 'Pagar agora (gera despesa)', action: 'pay', variant: 'primary' })
    items.push({ label: 'Editar valor / %', action: 'edit' })
    items.push({ label: 'Reverter aprovação', action: 'undo-approve', variant: 'danger', separator: true })
  } else if (status === 'PAID') {
    items.push({ label: 'Ver comprovante', action: 'receipt' })
    items.push({ label: 'Estornar pagamento', action: 'refund', variant: 'danger', separator: true })
  }
  return items
}

interface CommissionsTableProps {
  rows: CommissionItem[]
  brokers: Broker[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (ids: string[]) => void
  onAction: (action: string, row: CommissionItem) => void
}

export function CommissionsTable({ rows, brokers, selected, onToggle, onToggleAll, onAction }: CommissionsTableProps) {
  const brokerMap = new Map(brokers.map(b => [b.id, b]))
  const selectableRows = rows.filter(r => r.status !== 'PAID')
  const selectableIds = selectableRows.map(r => r.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))
  const someSelected = selectableIds.some(id => selected.has(id))
  const indeterminate = someSelected && !allSelected

  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="bg-surface-variant">
          <tr>
            <th className="px-4 py-3 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = indeterminate }}
                onChange={() => onToggleAll(selectableIds)}
                className="rounded border-border accent-primary"
                aria-label="Selecionar todas as comissões selecionáveis"
              />
            </th>
            {['Corretor', 'Imóvel / operação', 'Base', '%', 'IRRF', 'Líquido', 'Status', ''].map((h, i) => (
              <th
                key={i}
                className={cn(
                  'px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant',
                  ['Base', '%', 'IRRF', 'Líquido'].includes(h) ? 'text-right' : 'text-left',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">
                Nenhuma comissão encontrada.
              </td>
            </tr>
          )}
          {rows.map(row => {
            const broker = brokerMap.get(row.brokerId)
            const isSelected = selected.has(row.id)
            const selectable = row.status !== 'PAID'
            const meta = STATUS_META[row.status]
            const menuItems = getMenuItems(row.status)
            const isCaptador = row.captureBrokerId === row.brokerId && row.brokerSplit < 1
            const irrfStr = row.irrf > 0 && broker
              ? `IRRF ${Math.round((row.irrf / row.gross) * 100)}%`
              : null
            const regimeSub = broker
              ? `${broker.regime}${irrfStr ? ` · ${irrfStr}` : ''}`
              : ''

            return (
              <tr
                key={row.id}
                className={cn(
                  'border-t border-border transition-colors',
                  isSelected ? 'bg-[rgba(0,87,190,.05)]' : 'hover:bg-surface-container-low',
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!selectable}
                    onChange={() => onToggle(row.id)}
                    className="rounded border-border accent-primary disabled:opacity-40"
                    aria-label={`Selecionar comissão de ${broker?.name ?? ''} para ${row.property}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-full size-8 text-white text-[11px] font-bold"
                      style={{ background: 'linear-gradient(135deg, #0057be, #fd8b00)' }}
                    >
                      {broker ? brokerInitials(broker.name) : '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold text-on-surface">{broker?.name ?? row.brokerId}</p>
                        {isCaptador && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                            style={{ color: '#6f3c00', background: '#ffe5bf', letterSpacing: '0.02em' }}
                          >
                            Captador
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-on-surface-variant">{regimeSub}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-[13px] font-medium text-on-surface">{row.property}</p>
                  <p className="text-[11.5px] text-on-surface-variant font-mono">
                    {row.contractId} · {OP_LABEL[row.operation]}{row.brokerSplit < 1 ? ` · split ${Math.round(row.brokerSplit * 100)}%` : ''}
                  </p>
                </td>
                <td className="px-4 py-3 text-right text-[13px] tabular-nums text-on-surface-variant">
                  {fmtBRL(row.base)}
                </td>
                <td className="px-4 py-3 text-right text-[13px] tabular-nums text-on-surface-variant">
                  {row.operation === 'LEASE' && row.pct === 1 ? (
                    <span title="1 mês de aluguel">1×</span>
                  ) : fmtPct(row.pct)}
                </td>
                <td className="px-4 py-3 text-right text-[13px] tabular-nums">
                  {row.irrf > 0 ? (
                    <span className="text-[#7f1010]">−{fmtBRL(row.irrf)}</span>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-[13px] font-bold tabular-nums text-[#15803d]">
                  {fmtBRL(row.net)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={meta.badge}>{meta.label}</StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-7 p-0">
                        <MoreVertical className="size-4 text-on-surface-variant" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {menuItems.map(item => (
                        <React.Fragment key={item.action}>
                          {item.separator && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            onClick={() => onAction(item.action, row)}
                            className={item.variant === 'danger' ? 'text-destructive focus:text-destructive' : item.variant === 'primary' ? 'font-medium text-primary' : ''}
                          >
                            {item.label}
                          </DropdownMenuItem>
                        </React.Fragment>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}
