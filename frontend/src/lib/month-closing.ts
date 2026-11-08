// Fechamento do mês (spec month-closing): regras de exibição. O retrato vem calculado do backend.
import { formatDateBR } from './date-format'
import { todaySaoPaulo } from './lease-overview'
import { plural } from './property-format'

export type Bucket = { count: number; total: number }
export type PendingItem = { payment_id: string; tenant: string; amount: number; due_date: string; awaiting: boolean }
export type ClosingSnapshot = {
  forecast: Bucket
  received: Bucket
  overdue: Bucket
  receipts_issued: number
  pending: PendingItem[]
}
export type ClosingEvent = {
  id: string
  kind: 'CLOSED' | 'REOPENED'
  actor_name: string
  reason?: string
  created_at: string
}
export type MonthClosing = {
  month: string
  status: 'OPEN' | 'CLOSED'
  closed_at?: string
  closed_by_name?: string
  snapshot: ClosingSnapshot
  events: ClosingEvent[]
}

/** O mês já encerrou (anterior ao mês corrente em São Paulo) e pode ser fechado. */
export const isPastMonth = (ym: string, now: Date = new Date()) => ym < todaySaoPaulo(now).slice(0, 7)

/** "com 1 pendência (Bruno Lima)", "com 2 pendências" ou "sem pendências". */
export function pendingSummary(pending: PendingItem[]): string {
  if (pending.length === 0) return 'sem pendências'
  const base = `com ${plural(pending.length, 'pendência', 'pendências')}`
  return pending.length === 1 ? `${base} (${pending[0].tenant})` : base
}

export type ChecklistItem = { key: 'awaiting' | 'receipts' | 'late'; ok: boolean; title: string; text: string }

/** "Antes de fechar": informados confirmados, recibos gerados e cobranças em atraso (com nomes). */
export function buildChecklist(s: ClosingSnapshot): ChecklistItem[] {
  const awaiting = s.pending.filter((p) => p.awaiting)
  const late = s.pending.filter((p) => !p.awaiting)
  return [
    {
      key: 'awaiting',
      ok: awaiting.length === 0,
      title: 'Pagamentos informados confirmados',
      text: awaiting.length ? `${awaiting.length} aguardando confirmação: ${awaiting.map((p) => p.tenant).join(', ')}.` : 'Nenhum aguardando confirmação.',
    },
    {
      key: 'receipts',
      ok: s.receipts_issued === s.received.count,
      title: 'Recibos gerados',
      text: `${s.receipts_issued} de ${s.received.count} pagamentos têm recibo.`,
    },
    {
      key: 'late',
      ok: late.length === 0,
      title: late.length ? `${plural(late.length, 'cobrança', 'cobranças')} em atraso` : 'Nenhuma cobrança em atraso',
      text: late.map((p) => `${p.tenant} · ${formatDateBR(p.due_date)}`).join('; '),
    },
  ]
}

/** "02/11/2026, 21:05" em São Paulo. */
export function closedAtLabel(iso: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${date}, ${time}`
}
