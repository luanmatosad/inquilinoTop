'use client'

import * as React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUp, Check, Calendar, AlertTriangle, Search,
  Upload, MoreVertical, Send, Mail, FileText, X, Plus,
} from 'lucide-react'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorState, EmptyState } from '@/components/financial/shared'
import { fmtBRL, fmtDate } from '@/lib/format'
import { NewExpenseModal } from './NewExpenseModal'
import type { Payable, PayableStatus, PayableTab } from '../../actions'

export type PayablesState =
  | { kind: 'data'; payables: Payable[] }
  | { kind: 'error'; message?: string }
  | { kind: 'empty' }

// U+2212 minus sign (not hyphen)
const MINUS = '−'

const TODAY_MS = new Date().setHours(0, 0, 0, 0)

const TONE_COLORS = {
  success: { bg: '#d1fadf', fg: '#15803d', strong: 'var(--color-success-700)' },
  info:    { bg: '#dbe7ff', fg: '#00366f', strong: '#1e3a8a' },
  warning: { bg: '#fff0c2', fg: '#b45309', strong: 'var(--color-warning-700)' },
  error:   { bg: '#fee2e2', fg: '#7f1010', strong: 'var(--destructive)' },
}

const STATUS_TO_BADGE: Record<PayableStatus, React.ComponentProps<typeof StatusBadge>['status']> = {
  PAID:      'PAID',
  PENDING:   'PENDING',
  OVERDUE:   'OVERDUE',
  SCHEDULED: 'SCHEDULED',
}

interface SummaryCardProps {
  label: string
  caption: string
  value: number
  tone: keyof typeof TONE_COLORS
  icon: React.ComponentType<{ className?: string }>
}

function SummaryCard({ label, caption, value, tone, icon: Icon }: SummaryCardProps) {
  const colors = TONE_COLORS[tone]
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className="grid size-9 shrink-0 place-items-center rounded-lg"
          style={{ background: colors.bg, color: colors.fg }}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-on-surface-variant">{label}</p>
          <p
            className="mt-0.5 text-[20px] font-bold tabular-nums leading-tight"
            style={{ color: colors.strong }}
          >
            {MINUS}{fmtBRL(value)}
          </p>
          <p className="mt-0.5 text-[11.5px] text-on-surface-variant">{caption}</p>
        </div>
      </div>
    </Card>
  )
}

function MethodChip({ method }: { method: string }) {
  const isPix = method === 'PIX'
  return (
    <span
      className={`inline-block rounded-[6px] px-2 py-0.5 text-xs font-medium ${
        isPix
          ? 'bg-primary/8 text-primary tracking-[.02em]'
          : 'bg-surface-container text-on-surface-variant'
      }`}
    >
      {method}
    </span>
  )
}

type StatusFilter = PayableStatus | 'ALL'

interface PayablesClientProps {
  state: PayablesState
}

export function PayablesClient({ state }: PayablesClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<PayableTab>('VENDOR')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL')
  const [modalOpen, setModalOpen] = useState(false)

  const payables = state.kind === 'data' ? state.payables : []

  const vendorCount = payables.filter((p) => p.tab === 'VENDOR').length
  const taxCount = payables.filter((p) => p.tab === 'TAX').length

  const filtered = payables.filter((p) => {
    const matchTab = p.tab === activeTab
    const matchStatus = filterStatus === 'ALL' || p.status === filterStatus
    const q = searchTerm.toLowerCase()
    const matchSearch =
      q === '' ||
      p.supplier.toLowerCase().includes(q) ||
      p.property.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    return matchTab && matchStatus && matchSearch
  })

  const paid = payables.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
  const scheduled = payables.filter((p) => p.status === 'SCHEDULED').reduce((s, p) => s + p.amount, 0)
  const pending = payables.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0)
  const overdue = payables.filter((p) => p.status === 'OVERDUE').reduce((s, p) => s + p.amount, 0)

  const emptyTitle = activeTab === 'VENDOR'
    ? 'Nenhuma despesa com fornecedor'
    : 'Sem impostos ou taxas a pagar'
  const emptyBody = activeTab === 'VENDOR'
    ? 'Quando você registrar uma OS, reparo ou serviço terceirizado, aparecerá aqui.'
    : 'Cotas condominiais, IPTU e carnês importados aparecem nesta aba.'

  const toolbarDisabled = state.kind !== 'data'

  return (
    <>
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Contas a pagar</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Despesas, impostos e pagamentos a fornecedores.
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="size-4" />
          Nova despesa
        </Button>
      </div>

      {/* ─── Summary cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Pago no mês"  caption="Saídas confirmadas."           value={paid}      tone="success" icon={Check} />
        <SummaryCard label="Agendado"     caption="Aguardando data de débito."     value={scheduled} tone="info"    icon={Calendar} />
        <SummaryCard label="A pagar"      caption="Dentro do prazo de pagamento."  value={pending}   tone="warning" icon={ArrowUp} />
        <SummaryCard label="Em atraso"    caption="Risco de multa/juros."          value={overdue}   tone="error"   icon={AlertTriangle} />
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────── */}
      <div className="flex gap-6 border-b border-border">
        {([
          { id: 'VENDOR' as const, label: 'Fornecedores', count: vendorCount },
          { id: 'TAX'    as const, label: 'Impostos & taxas', count: taxCount },
        ]).map((tab) => (
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
            <span className="inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-full bg-surface-variant px-1.5 text-[11px] font-semibold tabular-nums">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Error / Empty states ─────────────────────────────────── */}
      {state.kind === 'error' && (
        <ErrorState
          title="Não foi possível carregar as despesas"
          body="Houve um erro de comunicação com o serviço financeiro. Verifique sua conexão e tente novamente."
          onRetry={() => router.refresh()}
        />
      )}

      {state.kind === 'empty' && (
        <EmptyState
          icon={ArrowUp}
          title={emptyTitle}
          body={emptyBody}
          action={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Nova despesa
            </Button>
          }
        />
      )}

      {/* ─── Toolbar + Table ─────────────────────────────────────── */}
      {state.kind === 'data' && (
        <>
          <Card
            className={`p-3.5 flex flex-wrap items-center justify-between gap-3 ${
              toolbarDisabled ? 'opacity-55 pointer-events-none' : ''
            }`}
          >
            <div className="relative w-full flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
              <Input
                className="pl-9"
                placeholder="Buscar por fornecedor, imóvel ou categoria…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-on-surface-variant">Status</span>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="SCHEDULED">Agendado</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="OVERDUE">Atrasado</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Upload className="size-3.5" />
                Exportar
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-variant">
                    {['Vencimento', 'Beneficiário / Imóvel', 'Categoria', 'Valor', 'Forma', 'Status', ''].map(
                      (col, i) => (
                        <th
                          key={i}
                          className={[
                            'px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant',
                            i === 0 ? 'pl-6' : '',
                            col === 'Valor' || i === 6 ? 'text-right' : 'text-left',
                          ].join(' ')}
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-on-surface-variant">
                        Nenhuma despesa encontrada com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => {
                      const daysLate = item.status === 'OVERDUE'
                        ? Math.ceil((TODAY_MS - new Date(item.due).setHours(0, 0, 0, 0)) / 86_400_000)
                        : 0

                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-surface-container-low"
                        >
                          {/* Vencimento */}
                          <td className="py-3 pl-6 pr-4 text-[13px] whitespace-nowrap text-on-surface-variant">
                            {fmtDate(item.due)}
                            {item.status === 'OVERDUE' && daysLate > 0 && (
                              <p className="text-[11px] text-destructive">{daysLate} dias em atraso</p>
                            )}
                          </td>
                          {/* Beneficiário / Imóvel */}
                          <td className="px-4 py-3">
                            <p className="max-w-[200px] truncate text-[13px] font-semibold text-on-surface">
                              {item.supplier}
                            </p>
                            <p className="max-w-[200px] truncate text-[12px] text-on-surface-variant">
                              {item.property}
                              {item.invoice && (
                                <>
                                  {' '}·{' '}
                                  <span className="font-mono text-[11.5px]">{item.invoice}</span>
                                </>
                              )}
                            </p>
                          </td>
                          {/* Categoria */}
                          <td className="px-4 py-3 text-[13px] text-on-surface-variant">{item.category}</td>
                          {/* Valor */}
                          <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-destructive whitespace-nowrap">
                            {MINUS}{fmtBRL(item.amount)}
                          </td>
                          {/* Forma */}
                          <td className="px-4 py-3">
                            <MethodChip method={item.method} />
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusBadge status={STATUS_TO_BADGE[item.status]} />
                          </td>
                          {/* Actions */}
                          <td className="py-3 pl-4 pr-6 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary">
                                  <MoreVertical className="size-4" />
                                  <span className="sr-only">Ações</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="min-w-[240px] rounded-[10px] border border-border bg-card p-1.5 shadow-md"
                              >
                                {item.status === 'OVERDUE' && (
                                  <>
                                    <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium text-primary">
                                      <Send className="size-4" />
                                      Pagar agora (PIX)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium">
                                      <Mail className="size-4" />
                                      Notificar fornecedor
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {item.status === 'PENDING' && (
                                  <>
                                    <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium">
                                      <Send className="size-4" />
                                      Pagar agora (PIX)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium">
                                      <Calendar className="size-4" />
                                      Agendar pagamento
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {item.status === 'SCHEDULED' && (
                                  <>
                                    <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium">
                                      <Send className="size-4" />
                                      Antecipar pagamento
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium">
                                      <X className="size-4" />
                                      Cancelar agendamento
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {item.status === 'PAID' && (
                                  <>
                                    <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium">
                                      <FileText className="size-4" />
                                      Ver comprovante
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium">
                                      <Upload className="size-4" />
                                      Baixar nota fiscal
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium">
                                  <FileText className="size-4" />
                                  Editar despesa
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-2.5 text-sm font-medium text-destructive hover:!bg-[rgba(186,26,26,.07)]">
                                  <X className="size-4" />
                                  Excluir despesa
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <NewExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
