'use client'

import * as React from 'react'
import { MoreVertical, Check } from 'lucide-react'
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
import { fmtBRL, fmtDate } from '@/lib/format'
import { MatchPreview } from './MatchPreview'
import { ConfidencePill } from './ConfidencePill'
import type { ReconLine, ReconStatus } from '../../actions'

const STATUS_META: Record<ReconStatus, { badge: 'PAID' | 'PENDING' | 'OVERDUE' | 'REVIEW'; label: string }> = {
  MATCHED:   { badge: 'PAID',    label: 'Conciliada' },
  SUGGESTED: { badge: 'PENDING', label: 'Sugerida' },
  UNMATCHED: { badge: 'OVERDUE', label: 'Sem match' },
  MANUAL:    { badge: 'REVIEW',  label: 'Manual' },
}

interface ReconTableProps {
  lines: ReconLine[]
  onConfirm: (lineId: string) => void
  onOpenMenu: (action: string, line: ReconLine) => void
}

function getMenuItems(status: ReconStatus) {
  const items: Array<{ label: string; action: string; variant?: 'danger' | 'primary'; separator?: boolean }> = []
  if (status === 'SUGGESTED') {
    items.push({ label: 'Confirmar match', action: 'confirm', variant: 'primary' })
    items.push({ label: 'Buscar outra sugestão', action: 'search' })
    items.push({ label: 'Vincular a item existente', action: 'link' })
    items.push({ label: 'Criar item', action: 'create' })
    items.push({ label: 'Marcar como avulso', action: 'avulso', variant: 'danger', separator: true })
  } else if (status === 'UNMATCHED') {
    items.push({ label: 'Vincular a item existente', action: 'link' })
    items.push({ label: 'Criar cobrança/despesa a partir desta linha', action: 'create' })
    items.push({ label: 'Marcar como avulso', action: 'avulso' })
  } else if (status === 'MATCHED') {
    items.push({ label: 'Ver item vinculado', action: 'view' })
    items.push({ label: 'Desfazer match', action: 'undo', variant: 'danger', separator: true })
  } else if (status === 'MANUAL') {
    items.push({ label: 'Ver item vinculado', action: 'view' })
    items.push({ label: 'Editar vínculo manual', action: 'edit' })
    items.push({ label: 'Desfazer vínculo', action: 'undo', variant: 'danger', separator: true })
  }
  return items
}

export function ReconTable({ lines, onConfirm, onOpenMenu }: ReconTableProps) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="bg-surface-variant">
          <tr>
            {['Data', 'Movimentação no extrato', 'Valor', 'Sugestão de match', 'Confiança', 'Status', ''].map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant text-left"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">
                Nenhuma movimentação encontrada.
              </td>
            </tr>
          )}
          {lines.map(line => {
            const meta = STATUS_META[line.status]
            const menuItems = getMenuItems(line.status)
            const showConfirmBtn = line.status === 'SUGGESTED'
            const showConfidencePill = line.status === 'SUGGESTED'

            return (
              <tr
                key={line.id}
                className="border-t border-border transition-colors hover:bg-surface-container-low"
              >
                <td className="px-4 py-3 text-[13px] font-medium tabular-nums whitespace-nowrap text-on-surface-variant">
                  {fmtDate(line.date)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-[13px] font-semibold font-mono text-on-surface">{line.desc}</p>
                  <p className="text-[11.5px] text-on-surface-variant">{line.counterparty}</p>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span
                    className={`text-[13px] font-semibold tabular-nums ${
                      line.amount > 0 ? 'text-[#15803d]' : 'text-on-surface'
                    }`}
                  >
                    {line.amount > 0 ? '+' : ''}{fmtBRL(line.amount)}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[260px]">
                  <MatchPreview match={line.match} />
                </td>
                <td className="px-4 py-3">
                  {showConfidencePill ? (
                    <ConfidencePill value={line.confidence} />
                  ) : (
                    <span className="text-[12.5px] text-on-surface-variant">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={meta.badge}>{meta.label}</StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {showConfirmBtn && (
                      <button
                        onClick={() => onConfirm(line.id)}
                        className="rounded-full px-2 py-1 text-[11.5px] font-medium text-primary bg-primary/8 hover:bg-primary/15 transition-colors"
                      >
                        <Check className="inline size-3 mr-1" />
                        Confirmar
                      </button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-7 p-0">
                          <MoreVertical className="size-4 text-on-surface-variant" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {menuItems.map((item) => (
                          <React.Fragment key={item.action}>
                            {item.separator && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              onClick={() => onOpenMenu(item.action, line)}
                              className={item.variant === 'danger' ? 'text-destructive focus:text-destructive' : item.variant === 'primary' ? 'font-medium text-primary' : ''}
                            >
                              {item.label}
                            </DropdownMenuItem>
                          </React.Fragment>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}
