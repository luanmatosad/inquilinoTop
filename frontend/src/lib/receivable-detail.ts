// Mensagem de cobrança, linha do tempo e decomposição do atraso do detalhe da cobrança
// (spec receivable-detail). Funções puras.
import { formatDateBR } from './date-format'
import { todaySaoPaulo } from './lease-overview'
import { formatCurrency } from './utils'

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PIX: 'Pix',
  CASH: 'Dinheiro',
  TRANSFER: 'Transferência',
  BOLETO: 'Boleto',
  OTHER: 'Outro',
}

// ---------- Mensagem de cobrança ----------

type ChargeMessageInput = {
  tenantName: string
  /** "novembro". */
  month: string
  /** "Ap 302 · Ed. Aurora". */
  where: string
  /** Valor da cobrança; atrasada: total atualizado de hoje. */
  amount: number
  /** "05/11". */
  dueLabel: string
  late: boolean
  /** Pix copia-e-cola; sem ele, o bloco do Pix some. */
  pix?: string | null
  ownerFirstName?: string
}

export function buildChargeMessage(i: ChargeMessageInput): string {
  const first = i.tenantName.trim().split(/\s+/)[0] || i.tenantName
  const amount = formatCurrency(i.amount)
  const lines: string[] = []
  lines.push(
    i.late
      ? `Oi, ${first}! O aluguel de ${i.month} (${i.where}) venceu em ${i.dueLabel} e ainda está em aberto: ${amount}, com multa e juros até hoje.`
      : `Oi, ${first}! Passando para lembrar do aluguel de ${i.month} (${i.where}): ${amount}, vence em ${i.dueLabel}.`,
  )
  if (i.pix) lines.push('', 'Pague pelo Pix (copia e cola):', i.pix)
  lines.push('', 'Qualquer dúvida, é só responder.' + (i.ownerFirstName ? ` — ${i.ownerFirstName}` : ''))
  return lines.join('\n')
}

export function mailtoUrl(email: string | null | undefined, subject: string, body: string): string | null {
  const to = email?.trim()
  if (!to) return null
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ---------- Linha do tempo ----------

export type TimelineApiItem = {
  kind: string
  at: string
  channel?: string | null
  data?: Record<string, unknown> | null
  actor_id?: string | null
  synthetic?: boolean
}
export type TimelineRow = { key: string; title: string; detail: string }

const SP = 'America/Sao_Paulo'
const dm = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: SP, day: '2-digit', month: '2-digit' }).format(new Date(iso))
const hm = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: SP, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
const dayMonth = (ymd: string) => formatDateBR(ymd).slice(0, 5)
const CHANNEL: Record<string, string> = { WHATSAPP: 'WhatsApp', EMAIL: 'e-mail' }

function by(item: TimelineApiItem, currentUserId?: string | null) {
  if (!item.actor_id) return ''
  return item.actor_id === currentUserId ? ' · por você' : ' · por um membro da equipe'
}

export function buildTimeline(items: TimelineApiItem[], currentUserId?: string | null): TimelineRow[] {
  return items.map((it, i) => {
    const key = `${it.kind}-${it.at}-${i}`
    const stamp = `${dm(it.at)}, ${hm(it.at)}`
    switch (it.kind) {
      case 'CREATED':
        return { key, title: 'Cobrança criada', detail: `${dm(it.at)} · gerada pelo contrato` }
      case 'OVERDUE':
        return { key, title: `Venceu em ${dayMonth(it.at.slice(0, 10))}`, detail: 'Sem pagamento informado' }
      case 'SENT':
        return it.channel === 'COPY'
          ? { key, title: 'Mensagem copiada', detail: `${stamp}${by(it, currentUserId)}` }
          : { key, title: `Enviada por ${CHANNEL[it.channel ?? ''] ?? 'mensagem'}`, detail: `${stamp}${by(it, currentUserId)}` }
      case 'REMINDER':
        return { key, title: 'Lembrete enviado', detail: `${stamp}${by(it, currentUserId)}` }
      case 'AGREEMENT': {
        const d = it.data ?? {}
        const parts = [
          typeof d.new_due_date === 'string' ? `nova data ${dayMonth(d.new_due_date)}` : '',
          typeof d.new_amount === 'number' ? formatCurrency(d.new_amount) : '',
          typeof d.note === 'string' ? d.note : '',
        ].filter(Boolean)
        return { key, title: 'Acordo de atraso', detail: `${parts.join(' · ')}${by(it, currentUserId)}` }
      }
      case 'PAID': {
        const d = it.data ?? {}
        const paid = typeof d.paid_date === 'string' ? dayMonth(d.paid_date) : dm(it.at)
        const parts = [
          paid,
          typeof d.amount === 'number' ? formatCurrency(d.amount) : '',
          typeof d.method === 'string' ? (PAYMENT_METHOD_LABEL[d.method] ?? d.method) : '',
        ].filter(Boolean)
        return { key, title: 'Pagamento registrado', detail: `${parts.join(' · ')}${by(it, currentUserId)}` }
      }
      default:
        return { key, title: it.kind, detail: stamp }
    }
  })
}

// ---------- Atraso ----------

/** 2 → "2"; 4.5 → "4,5". */
export const fmtPercent = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
const fmtNum = fmtPercent

type LateInput = {
  gross: number
  lateFee: number
  interest: number
  dueDate: string
  lateFeePercent: number
  /** Juros em % ao mês, como o contrato mostra. */
  monthlyInterestPercent: number
  now?: Date
}

export function lateBreakdown(i: LateInput) {
  const today = todaySaoPaulo(i.now ?? new Date())
  const due = i.dueDate.slice(0, 10)
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000))
  const total = Math.round((i.gross + i.lateFee + i.interest) * 100) / 100
  return {
    daysLate: days,
    total,
    lines: [
      { label: 'Aluguel', value: i.gross },
      { label: `Multa (${fmtNum(i.lateFeePercent)}%)`, value: i.lateFee },
      { label: `Juros (${fmtNum(i.monthlyInterestPercent)}% ao mês · ${days} ${days === 1 ? 'dia' : 'dias'})`, value: i.interest },
    ],
  }
}

/** Número do recibo no formato do canvas: 1, 2026 → "0001/2026". */
export function formatReceiptNumber(n?: number | null, year?: number | null): string {
  if (!n || !year) return '—'
  return `${String(n).padStart(4, '0')}/${year}`
}
