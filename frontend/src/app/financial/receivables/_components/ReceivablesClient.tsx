'use client'

import * as React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, MoreVertical, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorState, EmptyState } from '@/components/financial/shared'
import { fmtBRL, fmtDate } from '@/lib/format'
import { NewChargeModal } from './NewChargeModal'
import type { ActiveLease, Receivable, TransactionStatus } from '../../actions'

type TabId = 'RENT' | 'OTHER'
type StatusFilter = TransactionStatus | 'ALL'

const METHOD_LABEL: Record<string, string> = {
  BOLETO: 'Boleto',
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão',
}

const TABLE_COLS = ['Vencimento', 'Pagador / Imóvel', 'Competência', 'Valor', 'Forma', 'Status', '']

export type ReceivablesState =
  | { kind: 'data'; payments: Receivable[]; leases: ActiveLease[] }
  | { kind: 'loading' }
  | { kind: 'error'; message?: string }
  | { kind: 'empty' }

interface ReceivablesClientProps {
  state: ReceivablesState
}

export function ReceivablesClient({ state }: ReceivablesClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('RENT')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL')
  const [modalOpen, setModalOpen] = useState(false)

  const payments = state.kind === 'data' ? state.payments : []
  const leases = state.kind === 'data' ? state.leases : []

  const filtered = payments.filter((item) => {
    const matchTab =
      activeTab === 'RENT' ? item.type === 'RENT' : item.type !== 'RENT'
    const matchStatus =
      filterStatus === 'ALL' || item.status === filterStatus
    const q = searchTerm.toLowerCase()
    const matchSearch =
      q === '' ||
      item.payer.toLowerCase().includes(q) ||
      item.property.toLowerCase().includes(q)
    return matchTab && matchStatus && matchSearch
  })

  const countRent = payments.filter((r) => r.type === 'RENT').length
  const countOther = payments.filter((r) => r.type !== 'RENT').length

  const emptyTitle =
    activeTab === 'RENT'
      ? 'Sem aluguel pendente neste mês'
      : 'Nenhuma outra cobrança no momento'
  const emptyBody =
    activeTab === 'RENT'
      ? 'Quando você gerar a próxima fatura de aluguel, ela vai aparecer aqui.'
      : 'Reparos, multas e taxas extraordinárias aparecem aqui depois de gerados.'

  return (
    <>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            Contas a receber
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Módulo financeiro · gestão de cobranças
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="size-4" />
          Nova cobrança
        </Button>
      </div>

      {/* ─── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-6 border-b border-border">
        {(
          [
            { id: 'RENT', label: 'Aluguel', count: countRent },
            { id: 'OTHER', label: 'Outras cobranças', count: countOther },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'pb-3 text-sm font-medium transition-colors inline-flex items-center gap-1.5',
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-on-surface-variant hover:text-on-surface',
            ].join(' ')}
          >
            {tab.label}
            <span className="rounded-full bg-surface-variant px-1.5 py-0.5 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Error state ────────────────────────────────────────────── */}
      {state.kind === 'error' && (
        <ErrorState
          title="Não foi possível carregar as cobranças"
          body="Houve um erro de comunicação com o serviço financeiro. Verifique sua conexão e tente novamente."
          onRetry={() => router.refresh()}
        />
      )}

      {/* ─── Empty state (list truly empty, not filtered-away) ──────── */}
      {state.kind === 'empty' && (
        <EmptyState
          icon={Wallet}
          title={emptyTitle}
          body={emptyBody}
          action={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Nova cobrança
            </Button>
          }
        />
      )}

      {/* ─── Toolbar + Table ────────────────────────────────────────── */}
      {state.kind === 'data' && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
              <Input
                className="pl-9"
                placeholder="Buscar por pagador ou imóvel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="PAID">Pago</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="OVERDUE">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-variant">
                    {TABLE_COLS.map((col, i) => (
                      <th
                        key={i}
                        className={[
                          'px-4 py-3 text-xs font-medium uppercase tracking-wide text-on-surface-variant',
                          i === 0 ? 'pl-6' : '',
                          i === TABLE_COLS.length - 1
                            ? 'pr-6 text-right'
                            : 'text-left',
                        ].join(' ')}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={TABLE_COLS.length}
                        className="py-12 text-center text-sm text-on-surface-variant"
                      >
                        Nenhuma cobrança encontrada com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-surface-container-low"
                      >
                        <td className="py-3 pl-6 pr-4 text-[13px] whitespace-nowrap text-on-surface-variant">
                          {fmtDate(item.dueDate)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[180px] truncate font-semibold text-on-surface">
                            {item.payer}
                          </p>
                          <p className="max-w-[180px] truncate text-xs text-on-surface-variant">
                            {item.property}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-on-surface-variant whitespace-nowrap">
                          {item.property ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-on-surface whitespace-nowrap">
                          {fmtBRL(item.amount)}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {METHOD_LABEL[item.paymentMethod] ?? item.paymentMethod}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-3 pl-4 pr-6 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary">
                                <MoreVertical className="size-4" />
                                <span className="sr-only">Ações</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {item.status === 'OVERDUE' && (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={`/financial/receivables?charge=${item.id}`}
                                  >
                                    Cobrar via WhatsApp
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem disabled={item.status !== 'PAID'}>
                                Ver recibo
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <NewChargeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        leases={leases}
      />
    </>
  )
}
