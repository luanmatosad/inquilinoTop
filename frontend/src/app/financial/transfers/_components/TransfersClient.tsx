'use client'

import * as React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorState, EmptyState } from '@/components/financial/shared'
import { fmtBRL, fmtDate } from '@/lib/format'
import { showToast } from '@/lib/sonner'
import { approveTransfer, batchApproveTransfers } from '../../actions'
import type { Transfer, TransfersResponse, TransferStatus } from '../../actions'

export type TransfersState =
  | { kind: 'data'; data: TransfersResponse }
  | { kind: 'error' }
  | { kind: 'empty' }

const propsLabel = (n: number) => `${n} ${n === 1 ? 'imóvel' : 'imóveis'}`

function transferStatusBadge(status: TransferStatus) {
  if (status === 'PENDING')  return <StatusBadge status="PENDING">Aguardando</StatusBadge>
  if (status === 'APPROVED') return <StatusBadge status="REVIEW">Aprovado</StatusBadge>
  if (status === 'SENT')     return <StatusBadge status="PAID">Enviado</StatusBadge>
  return <StatusBadge status="NEUTRAL" />
}

function monthName(yyyy_mm: string) {
  const [y, m] = yyyy_mm.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

interface TransferLineProps {
  label: string
  value: string
  positive?: boolean
  bold?: boolean
}

function TransferLine({ label, value, positive, bold }: TransferLineProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span
        className={`text-sm text-on-surface ${bold ? 'font-bold' : 'font-normal'}`}
      >
        {label}
      </span>
      <span
        className={`text-sm tabular-nums ${bold ? 'text-base font-bold' : 'font-semibold'}`}
        style={{
          color: bold || positive ? 'var(--color-success-700)' : 'var(--on-surface)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

interface ExtractModalProps {
  transfer: Transfer | null
  onClose: () => void
  onApprove: (t: Transfer) => void
}

function ExtractModal({ transfer, onClose, onApprove }: ExtractModalProps) {
  if (!transfer) return null
  const totalDisc = transfer.tax + transfer.iptu
  return (
    <Dialog open={!!transfer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Extrato de repasse — {transfer.owner}</DialogTitle>
          <DialogDescription>
            Decomposição de bruto, deduções e líquido para {transfer.owner}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-0.5 py-2">
          <TransferLine
            label="Valor do aluguel recebido"
            value={`+ ${fmtBRL(transfer.gross)}`}
            positive
          />
          <TransferLine
            label="Taxa de administração"
            value={`− ${fmtBRL(transfer.fee)}`}
          />
          <TransferLine
            label="Retenção IRRF (Carnê-leão)"
            value={`− ${fmtBRL(transfer.tax)}`}
          />
          {transfer.iptu > 0 && (
            <TransferLine
              label="IPTU retido"
              value={`− ${fmtBRL(transfer.iptu)}`}
            />
          )}
          {totalDisc === 0 && (
            <TransferLine
              label="Retenção IRRF (Carnê-leão)"
              value={`− ${fmtBRL(0)}`}
            />
          )}
          <div className="my-1.5 h-px bg-border" />
          <TransferLine
            label="Total a repassar"
            value={fmtBRL(transfer.net)}
            bold
            positive
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {transfer.status === 'PENDING' && (
            <Button onClick={() => onApprove(transfer)}>
              <Send className="size-3.5" />
              Aprovar e gerar transferência
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface TransfersClientProps {
  state: TransfersState
}

export function TransfersClient({ state }: TransfersClientProps) {
  const router = useRouter()
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null)
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  const data = state.kind === 'data' ? state.data : null
  const pendingCount = data?.transfers.filter((t) => t.status === 'PENDING').length ?? 0

  async function handleApprove(t: Transfer) {
    setIsApproving(true)
    try {
      await approveTransfer(t.id)
      showToast.success(`Repasse de ${t.owner} aprovado.`)
      setSelectedTransfer(null)
      router.refresh()
    } catch {
      showToast.error('Falha ao aprovar repasse. Tente novamente.')
    } finally {
      setIsApproving(false)
    }
  }

  async function handleBatchApprove() {
    if (!data) return
    setIsApproving(true)
    try {
      const res = await batchApproveTransfers(data.month)
      const schedDate = data.processDate ? fmtDate(data.processDate) : ''
      showToast.success(
        `${res.approved} repasses aprovados. Remessa programada para ${schedDate}.`,
      )
      setConfirmBatchOpen(false)
      router.refresh()
    } catch {
      showToast.error('Falha ao aprovar repasses. Tente novamente.')
    } finally {
      setIsApproving(false)
    }
  }

  return (
    <>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Repasses</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Pagamentos líquidos aos proprietários.
          </p>
        </div>
        <Button size="sm" onClick={() => setConfirmBatchOpen(true)} disabled={pendingCount === 0}>
          <Send className="size-4" />
          Processar repasses do mês
        </Button>
      </div>

      {/* ─── Error / Empty ─────────────────────────────────────── */}
      {state.kind === 'error' && (
        <ErrorState
          title="Não foi possível carregar os repasses"
          body="Houve um erro de comunicação com o serviço financeiro. Verifique sua conexão e tente novamente."
          onRetry={() => router.refresh()}
        />
      )}

      {state.kind === 'empty' && (
        <EmptyState
          icon={Send}
          title="Sem repasses neste mês"
          body="Quando você tiver aluguéis recebidos para repassar, aparecerão aqui."
        />
      )}

      {/* ─── Summary banner ────────────────────────────────────── */}
      {data && (
        <Card
          className="p-4"
          style={{
            background: 'linear-gradient(180deg, var(--card), var(--surface-variant))',
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-on-surface-variant">
                Total líquido a repassar — {monthName(data.month)}
              </p>
              <p className="text-[28px] font-bold tracking-tight tabular-nums">
                {fmtBRL(data.totalNet)}
              </p>
              <p className="text-[12px] text-on-surface-variant">
                {data.transfers.length}{' '}
                {data.transfers.length === 1 ? 'proprietário' : 'proprietários'}
                {data.processDate && (
                  <> · processa em {fmtDate(data.processDate)}</>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/v1/transfers/cnab?month=${data.month}`} download>
                  <Upload className="size-3.5" />
                  Exportar CNAB
                </a>
              </Button>
              <Button variant="outline" size="sm" disabled>
                Ver histórico
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Table ─────────────────────────────────────────────── */}
      {data && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-variant">
                  {['Proprietário', 'Imóveis', 'Recebimento bruto', 'Taxa adm.', 'Descontos', 'Líquido', 'Status', ''].map(
                    (col, i) => (
                      <th
                        key={i}
                        className={[
                          'px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant',
                          i === 0 ? 'pl-6 text-left' : '',
                          i >= 2 && i <= 5 ? 'text-right' : '',
                          i === 1 || i === 6 || i === 7 ? 'text-left' : '',
                        ].join(' ')}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.transfers.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer transition-colors hover:bg-surface-container-low"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTransfer(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedTransfer(t)
                      }
                    }}
                  >
                    <td className="py-3 pl-6 pr-4 text-[13px] font-semibold text-on-surface whitespace-nowrap">
                      {t.owner}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-on-surface-variant whitespace-nowrap">
                      {propsLabel(t.properties)}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-on-surface whitespace-nowrap">
                      {fmtBRL(t.gross)}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums text-on-surface-variant whitespace-nowrap">
                      {'−'}{fmtBRL(t.fee)}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums text-on-surface-variant whitespace-nowrap">
                      {t.tax + t.iptu > 0 ? `−${fmtBRL(t.tax + t.iptu)}` : '−'}
                    </td>
                    <td
                      className="px-4 py-3 text-right text-[13px] font-bold tabular-nums whitespace-nowrap"
                      style={{ color: 'var(--color-success-700)' }}
                    >
                      {fmtBRL(t.net)}
                    </td>
                    <td className="px-4 py-3">
                      {transferStatusBadge(t.status)}
                    </td>
                    <td
                      className="py-3 pl-4 pr-6 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedTransfer(t)}
                      >
                        Ver extrato
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── Extract modal ─────────────────────────────────────── */}
      <ExtractModal
        transfer={selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        onApprove={handleApprove}
      />

      {/* ─── Batch approve dialog ──────────────────────────────── */}
      <AlertDialog open={confirmBatchOpen} onOpenChange={setConfirmBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar repasses pendentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a aprovar {pendingCount}{' '}
              {pendingCount === 1 ? 'repasse' : 'repasses'} no valor total de{' '}
              {fmtBRL(
                data?.transfers
                  .filter((t) => t.status === 'PENDING')
                  .reduce((s, t) => s + t.net, 0) ?? 0,
              )}
              . Esta ação aprova todos os repasses pendentes deste mês.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchApprove} disabled={isApproving}>
              {isApproving ? 'Aprovando…' : 'Aprovar tudo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
