'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState, EmptyState } from '@/components/financial/shared'
import { showToast } from '@/lib/sonner'
import { confirmMatch, markAvulso, undoMatch } from '../../actions'
import { ReconAccountTabs } from './ReconAccountTabs'
import { ReconSummary } from './ReconSummary'
import { ReconToolbar } from './ReconToolbar'
import { ReconTable } from './ReconTable'
import { ImportStatementModal } from './ImportStatementModal'
import { LinkExistingModal } from './LinkExistingModal'
import { CreateFromLineModal } from './CreateFromLineModal'
import type { BankAccount, ReconciliationResponse, ReconLine } from '../../actions'

interface ReconciliationClientProps {
  accounts: BankAccount[]
  data: ReconciliationResponse | null
  error: boolean
  currentAccountId: string
}

export function ReconciliationClient({
  accounts,
  data,
  error,
  currentAccountId,
}: ReconciliationClientProps) {
  const router = useRouter()
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('ALL')
  const [confidence, setConfidence] = React.useState(90)
  const [importOpen, setImportOpen] = React.useState(false)
  const [linkLine, setLinkLine] = React.useState<ReconLine | null>(null)
  const [createLine, setCreateLine] = React.useState<ReconLine | null>(null)

  function refresh() {
    router.refresh()
  }

  async function handleConfirm(lineId: string) {
    const res = await confirmMatch(lineId)
    if (res.ok) {
      showToast.success('Movimentação conciliada com sucesso.')
      refresh()
    } else {
      showToast.error('Erro ao confirmar match.')
    }
  }

  async function handleMenuAction(action: string, line: ReconLine) {
    if (action === 'confirm') {
      await handleConfirm(line.id)
    } else if (action === 'link') {
      setLinkLine(line)
    } else if (action === 'create') {
      setCreateLine(line)
    } else if (action === 'avulso') {
      const res = await markAvulso(line.id)
      if (res.ok) {
        showToast.success('Movimentação marcada como avulso.')
        refresh()
      }
    } else if (action === 'undo') {
      const res = await undoMatch(line.id)
      if (res.ok) {
        showToast.success('Match desfeito.')
        refresh()
      }
    }
  }

  if (accounts.length === 0) {
    return (
      <main className="space-y-5 px-8 py-6 pb-16">
        <PageHeader onImport={() => setImportOpen(true)} />
        <EmptyState
          icon={Upload}
          title="Nenhuma conta bancária cadastrada"
          body="Cadastre sua primeira conta bancária em Configurações → Contas."
          action={<Button variant="outline">Ir para Configurações</Button>}
        />
      </main>
    )
  }

  const lines = data?.lines ?? []

  const filtered = lines.filter(line => {
    const matchesSearch = !search || (
      line.desc.toLowerCase().includes(search.toLowerCase()) ||
      line.counterparty.toLowerCase().includes(search.toLowerCase()) ||
      (line.match?.title ?? '').toLowerCase().includes(search.toLowerCase())
    )
    const matchesStatus = statusFilter === 'ALL' || line.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const suggestionsAboveThreshold = filtered.filter(
    l => l.status === 'SUGGESTED' && Math.round(l.confidence * 100) >= confidence
  ).length

  const totalIn = lines.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0)
  const totalOut = lines.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0)

  return (
    <main className="space-y-5 px-8 py-6 pb-16">
      <PageHeader onImport={() => setImportOpen(true)} />

      <ReconAccountTabs accounts={accounts} currentId={currentAccountId} />

      {error ? (
        <ErrorState onRetry={refresh} />
      ) : (
        <>
          {data && (
            <ReconSummary
              counts={data.counts}
              netInflow={totalIn + totalOut}
              totalIn={totalIn}
              totalOut={totalOut}
            />
          )}

          <ReconToolbar
            search={search}
            onSearch={setSearch}
            status={statusFilter}
            onStatus={setStatusFilter}
            confidence={confidence}
            onConfidence={setConfidence}
            suggestionsAboveThreshold={suggestionsAboveThreshold}
            accountId={currentAccountId}
            onBatchSuccess={refresh}
          />

          {lines.length === 0 ? (
            <EmptyState
              icon={Upload}
              title={`Nenhum extrato importado para ${data?.account.label ?? 'esta conta'}`}
              body="Importe um arquivo OFX ou CNAB-240 para visualizar e conciliar as movimentações."
              action={
                <Button onClick={() => setImportOpen(true)}>
                  <Upload className="mr-2 size-4" />
                  Importar extrato
                </Button>
              }
            />
          ) : (
            <ReconTable
              lines={filtered}
              onConfirm={handleConfirm}
              onOpenMenu={handleMenuAction}
            />
          )}
        </>
      )}

      <ImportStatementModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        accounts={accounts}
        currentAccountId={currentAccountId}
        onSuccess={refresh}
      />
      <LinkExistingModal
        open={linkLine !== null}
        onClose={() => setLinkLine(null)}
        line={linkLine}
        onSuccess={refresh}
      />
      <CreateFromLineModal
        open={createLine !== null}
        onClose={() => setCreateLine(null)}
        line={createLine}
        onSuccess={refresh}
      />
    </main>
  )
}

function PageHeader({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">Conciliação bancária</h1>
        <p className="text-[13px] text-on-surface-variant mt-0.5">
          Compare movimentações do extrato com cobranças e despesas registradas.
          Aceite as sugestões ou crie vínculos manuais.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" disabled>
          <FileText className="mr-2 size-4" />
          Ver histórico
        </Button>
        <Button onClick={onImport}>
          <Upload className="mr-2 size-4" />
          Importar extrato
        </Button>
      </div>
    </div>
  )
}
