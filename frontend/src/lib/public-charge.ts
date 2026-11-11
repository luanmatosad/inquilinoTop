// Página pública da cobrança (spec public-payment-link / payment-report): tipos da resposta, regras do
// formulário "já paguei" e textos. Funções puras; a busca fica na página e a gravação na server action.
import { z } from 'zod'

import { MONTHS } from './date-format'
import { parseDecimal } from './form-utils'

type PublicChargeStatus = 'PENDING' | 'LATE' | 'AWAITING_CONFIRMATION' | 'PAID'

export type PublicCharge = {
  landlord_name: string
  amount: number
  due_date: string
  unit_label?: string
  competency?: string
  description?: string
  status: PublicChargeStatus
  paid_date?: string
  receipt_number?: string
  reported_at?: string
  reported_amount?: number
  reported_date?: string
}

export type PublicReceipt = {
  number?: string
  competency?: string
  issued_at: string
  paid_date: string
  payment_method?: string
  owner: { name: string }
  tenant: { name: string }
  unit: { label?: string }
  amounts: { gross: number; late_fee: number; interest: number; discount?: number; irrf_withheld: number; net_paid: number }
  legal_note: string
}

export const MAX_PROOF_BYTES = 5 * 1024 * 1024
const PROOF_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const
const MAX_AGE_DAYS = 60

/** "1.850,00", "1850,00" e "1850.00" valem; resto é NaN. */
export function parseAmount(v: string): number {
  const s = v.trim()
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'))
  return parseDecimal(s)
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Schema do "já paguei"; `today` é AAAA-MM-DD em São Paulo. O backend repete as mesmas regras. */
export const reportSchemaFor = (today: string) =>
  z.object({
    amount: z.string().refine((v) => Number.isFinite(parseAmount(v)) && parseAmount(v) > 0, 'Informe um valor maior que zero'),
    paid_date: z
      .string()
      .regex(DATE, 'Informe a data do pagamento')
      .refine((d) => d <= today, 'A data não pode ser futura')
      .refine((d) => d >= addDays(today, -MAX_AGE_DAYS), 'A data é antiga demais (até 60 dias)'),
  })

/** Valida o comprovante antes de enviar; o backend confere o tipo pelo conteúdo. Nulo = tudo certo. */
export function validateProof(file: { size: number; type: string } | null): string | null {
  if (!file) return null
  if (file.size === 0) return 'O arquivo está vazio.'
  if (file.size > MAX_PROOF_BYTES) return 'O comprovante deve ter até 5 MB.'
  if (!(PROOF_TYPES as readonly string[]).includes(file.type)) return 'Envie uma foto (JPEG ou PNG) ou um PDF.'
  return null
}

export function chargeTitle(c: { competency?: string; description?: string }): string {
  if (c.competency && /^\d{4}-(0[1-9]|1[0-2])$/.test(c.competency)) {
    return `Aluguel de ${MONTHS[Number(c.competency.slice(5, 7)) - 1].toLowerCase()}`
  }
  return c.description?.trim() || 'Cobrança de aluguel'
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'o locador'
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

const SP = 'America/Sao_Paulo'
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: SP }).format(d)

/** "Hoje, 09:12" ou "06/11, 09:12" (horário de São Paulo). */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  const hm = new Intl.DateTimeFormat('pt-BR', { timeZone: SP, hour: '2-digit', minute: '2-digit', hour12: false }).format(at)
  if (dayKey(at) === dayKey(now)) return `Hoje, ${hm}`
  const dm = new Intl.DateTimeFormat('pt-BR', { timeZone: SP, day: '2-digit', month: '2-digit' }).format(at)
  return `${dm}, ${hm}`
}
