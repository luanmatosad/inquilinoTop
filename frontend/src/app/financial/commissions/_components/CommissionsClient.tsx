'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState, EmptyState } from '@/components/financial/shared'
import { showToast } from '@/lib/sonner'
import {
  approveCommission, rejectCommission, payCommission,
  undoApproveCommission, refundCommission,
  batchApproveCommissions, batchPayCommissions,
} from '../../actions'
import { CommissionsSummary } from './CommissionsSummary'
import { CommissionsTabBar } from './CommissionsTabBar'
import { CommissionsToolbar } from './CommissionsToolbar'
import { BulkActionBar } from './BulkActionBar'
import { CommissionsTable } from './CommissionsTable'
import { NewCommissionModal } from './NewCommissionModal'
import type { CommissionsResponse, CommissionItem, CommissionOperation } from '../../actions'

interface CommissionsClientProps {
  data: CommissionsResponse | null
  error: boolean
  activeTab: CommissionOperation
}

export function CommissionsClient({ data, error, activeTab }: CommissionsClientProps) {
  const router = useRouter()
  const [search, setSearch] = React.useState('')
  const [filterBroker, setFilterBroker] = React.useState('ALL')
  const [filterStatus, setFilterStatus] = React.useState('ALL')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = React.useState(false)

  const commissions = data?.commissions ?? []
  const brokers = data?.brokers ?? []

  const tabCommissions = commissions.filter(c => c.operation === activeTab)
  const tabTotals = {
    pending: tabCommissions.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.net, 0),
    approved: tabCommissions.filter(c => c.status === 'APPROVED').reduce((s, c) => s + c.net, 0),
    paid: tabCommissions.filter(c => c.status === 'PAID').reduce((s, c) => s + c.net, 0),
    irrf: tabCommissions.reduce((s, c) => s + c.irrf, 0),
  }

  const filtered = tabCommissions.filter(c => {
    const matchesSearch = !search || (
      (brokers.find(b => b.id === c.brokerId)?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      c.property.toLowerCase().includes(search.toLowerCase()) ||
      c.contractId.toLowerCase().includes(search.toLowerCase())
    )
    const matchesBroker = filterBroker === 'ALL' || c.brokerId === filterBroker
    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus
    return matchesSearch && matchesBroker && matchesStatus
  })

  function handleToggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggleAll(ids: string[]) {
    setSelected(prev => {
      const allSelected = ids.every(id => prev.has(id))
      if (allSelected) return new Set([...prev].filter(id => !ids.includes(id)))
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })
  }

  function refresh() {
    router.refresh()
  }

  async function handleAction(action: string, row: CommissionItem) {
    if (action === 'approve') {
      const res = await approveCommission(row.id)
      if (res.ok) { showToast.success('Comissão aprovada.'); refresh() }
    } else if (action === 'reject') {
      const res = await rejectCommission(row.id)
      if (res.ok) { showToast.success('Comissão recusada.'); refresh() }
    } else if (action === 'pay') {
      const res = await payCommission(row.id)
      if (res.ok) { showToast.success('Comissão paga. Despesa gerada em Contas a pagar.'); refresh() }
    } else if (action === 'undo-approve') {
      const res = await undoApproveCommission(row.id)
      if (res.ok) { showToast.success('Aprovação revertida.'); refresh() }
    } else if (action === 'refund') {
      const res = await refundCommission(row.id)
      if (res.ok) { showToast.success('Pagamento estornado.'); refresh() }
    }
  }

  async function handleBatchApprove(ids: string[]) {
    const res = await batchApproveCommissions(ids)
    if (res.ok) {
      const n = res.approved
      showToast.success(`${n} comissão${n !== 1 ? 'ões' : ''} aprovada${n !== 1 ? 's' : ''}.`)
      setSelected(new Set())
      refresh()
    }
  }

  async function handleBatchPay(ids: string[]) {
    const res = await batchPayCommissions(ids)
    if (res.ok) {
      const n = res.paid
      showToast.success(`${n} comissão${n !== 1 ? 'ões' : ''} paga${n !== 1 ? 's' : ''}. Geradas como despesa (Payables) automaticamente.`)
      setSelected(new Set())
      refresh()
    }
  }

  const selectedItems = filtered.filter(c => selected.has(c.id))
  const pendingSelected = selectedItems.filter(c => c.status === 'PENDING')
  const approvedSelected = selectedItems.filter(c => c.status === 'APPROVED')

  const emptyByTab = {
    LEASE: { title: 'Sem comissões de locação', body: 'Ao confirmar uma locação com corretor associado, a comissão aparecerá aqui automaticamente.' },
    SALE: { title: 'Sem comissões de venda', body: 'Após registrar uma venda, calcule e registre a comissão para aprovação.' },
    CAPTURE: { title: 'Sem comissões de captação', body: 'Captações isoladas (sem fechamento) aparecem aqui enquanto aguardam pagamento.' },
  }

  return (
    <main className="space-y-5 px-8 py-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Comissões</h1>
          <p className="text-[13px] text-on-surface-variant mt-0.5">
            Comissões devidas a corretores em locações, vendas e captações.
            Aprovação manual; ao pagar, vira despesa em Contas a pagar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Upload className="mr-2 size-4" />
            Exportar
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 size-4" />
            Nova comissão
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={refresh} />
      ) : (
        <>
          <CommissionsSummary {...tabTotals} />

          <CommissionsTabBar
            activeTab={activeTab}
            commissions={commissions}
          />

          <CommissionsToolbar
            search={search}
            onSearch={setSearch}
            filterBroker={filterBroker}
            onFilterBroker={setFilterBroker}
            filterStatus={filterStatus}
            onFilterStatus={setFilterStatus}
            brokers={brokers}
          />

          <BulkActionBar
            selected={selected}
            pendingIds={pendingSelected.map(c => c.id)}
            approvedIds={approvedSelected.map(c => c.id)}
            pendingTotal={pendingSelected.reduce((s, c) => s + c.net, 0)}
            approvedTotal={approvedSelected.reduce((s, c) => s + c.net, 0)}
            onApprove={handleBatchApprove}
            onPay={handleBatchPay}
            onClear={() => setSelected(new Set())}
          />

          {tabCommissions.length === 0 ? (
            <EmptyState
              icon={Plus}
              title={emptyByTab[activeTab].title}
              body={emptyByTab[activeTab].body}
              action={
                <Button onClick={() => setModalOpen(true)}>
                  <Plus className="mr-2 size-4" />
                  Nova comissão
                </Button>
              }
            />
          ) : (
            <CommissionsTable
              rows={filtered}
              brokers={brokers}
              selected={selected}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              onAction={handleAction}
            />
          )}
        </>
      )}

      <NewCommissionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        brokers={brokers}
        onSuccess={refresh}
      />
    </main>
  )
}
