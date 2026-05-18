'use client'

import { Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { Broker } from '../../actions'

const STATUS_OPTS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'APPROVED', label: 'Aprovada' },
  { value: 'PAID', label: 'Paga' },
]

interface CommissionsToolbarProps {
  search: string
  onSearch: (v: string) => void
  filterBroker: string
  onFilterBroker: (v: string) => void
  filterStatus: string
  onFilterStatus: (v: string) => void
  brokers: Broker[]
}

export function CommissionsToolbar({
  search, onSearch,
  filterBroker, onFilterBroker,
  filterStatus, onFilterStatus,
  brokers,
}: CommissionsToolbarProps) {
  return (
    <Card className="p-[14px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar por corretor, imóvel ou contrato…"
              value={search}
              onChange={e => onSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-4 text-[13px] outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filterBroker}
            onChange={e => onFilterBroker(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">Corretor: Todos</option>
            {brokers.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => onFilterStatus(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary"
          >
            {STATUS_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  )
}
