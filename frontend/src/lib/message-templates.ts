// Lembretes de cobrança (spec charge-reminders): variáveis, preenchimento do modelo, escolha pelo vencimento e
// validação espelhada do backend (`internal/settings`, que é quem vale). Funções puras.
import { formatCurrency } from './utils'

export type Reminder = { name: string; offset_days: number; body: string }

export const REMINDER_VARIABLES = [
  { name: 'nome', token: '{nome}', hint: 'Primeiro nome do inquilino' },
  { name: 'valor', token: '{valor}', hint: 'Valor da cobrança (atrasada: total de hoje)' },
  { name: 'vencimento', token: '{vencimento}', hint: 'Dia e mês do vencimento' },
  { name: 'imóvel', token: '{imóvel}', hint: 'Unidade e imóvel' },
  { name: 'pix', token: '{pix}', hint: 'Pix copia e cola' },
  { name: 'mês', token: '{mês}', hint: 'Mês da cobrança' },
  { name: 'link', token: '{link}', hint: 'Link da página de pagamento (ou o Pix, se o link ainda não foi gerado)' },
] as const

export const MAX_REMINDERS = 8
const MAX_NAME = 40
export const MAX_BODY = 1000
const MIN_OFFSET = -30
const MAX_OFFSET = 60

/** Dados de exemplo da prévia (a Marina do canvas). */
export const SAMPLE_VARIABLES: Record<string, string> = {
  nome: 'Marina',
  valor: 'R$ 1.850,00',
  vencimento: '05/11',
  imóvel: 'Ap 302 · Ed. Aurora',
  mês: 'novembro',
  pix: '00020126580014br.gov.bcb.pix…',
  link: 'imoviflow.app/p/k3x9a',
}

/** Troca `{variável}` pelo valor. Desconhecidas ficam como estão; variável vazia não deixa espaço nem linha sobrando. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body
    .replace(/\{([^{}]*)\}/g, (m, name: string) => (Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m))
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

type ChargeInput = {
  tenantName: string
  /** "novembro". */
  month: string
  /** "Ap 302 · Ed. Aurora". */
  where: string
  /** Valor da cobrança; atrasada: total atualizado de hoje. */
  amount: number
  /** "05/11". */
  dueLabel: string
  pix?: string | null
  /** Link da página pública, quando já foi gerado. */
  link?: string | null
}

/** Variáveis de uma cobrança. `{link}` é o link se existe, senão o Pix (o link substitui o código), senão vazio. */
export function chargeVariables(i: ChargeInput): Record<string, string> {
  const nome = i.tenantName.trim().split(/\s+/)[0] || i.tenantName
  return {
    nome,
    valor: formatCurrency(i.amount),
    vencimento: i.dueLabel,
    imóvel: i.where,
    mês: i.month,
    pix: i.pix ?? '',
    link: i.link ?? i.pix ?? '',
  }
}

/** Dias desde o vencimento (negativo antes de vencer). Datas AAAA-MM-DD (ou ISO). */
export function daysFromDue(due: string, today: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((ms(today) - ms(due)) / 86_400_000)
}

/** O lembrete de maior `offset_days` menor ou igual aos dias desde o vencimento; se está mais cedo que todos, o primeiro. */
export function pickReminder(list: Reminder[] | null | undefined, days: number): Reminder | null {
  if (!list || list.length === 0) return null
  const sorted = [...list].sort((a, b) => a.offset_days - b.offset_days)
  let chosen = sorted[0]
  for (const r of sorted) if (r.offset_days <= days) chosen = r
  return chosen
}

export function offsetLabel(n: number): string {
  if (n === 0) return 'No dia do vencimento'
  const abs = Math.abs(n)
  const unit = abs === 1 ? 'dia' : 'dias'
  return n < 0 ? `${abs} ${unit} antes do vencimento` : `${n} ${unit} depois`
}

const runes = (s: string) => Array.from(s).length

/** Primeiro problema da lista (mesmas regras e faixas do backend), ou `null`. */
export function validateReminders(list: Reminder[]): string | null {
  if (list.length < 1 || list.length > MAX_REMINDERS) return `Informe de 1 a ${MAX_REMINDERS} lembretes.`
  const seen = new Set<number>()
  const known = new Set<string>(REMINDER_VARIABLES.map((v) => v.name))
  for (const r of list) {
    const name = r.name.trim()
    const body = r.body.trim()
    if (runes(name) < 1 || runes(name) > MAX_NAME) return `O nome do lembrete vai de 1 a ${MAX_NAME} caracteres.`
    if (!Number.isInteger(r.offset_days) || r.offset_days < MIN_OFFSET || r.offset_days > MAX_OFFSET) return `Os dias vão de ${MIN_OFFSET} a ${MAX_OFFSET} em relação ao vencimento.`
    if (seen.has(r.offset_days)) return `Dois lembretes não podem ter os mesmos dias (${r.offset_days}).`
    seen.add(r.offset_days)
    if (runes(body) < 1 || runes(body) > MAX_BODY) return `O texto vai de 1 a ${MAX_BODY} caracteres.`
    for (const m of body.matchAll(/\{([^{}]*)\}/g)) if (!known.has(m[1])) return `Variável desconhecida: {${m[1]}}.`
  }
  return null
}

/** Insere `token` na posição do cursor (ou no lugar da seleção; sem cursor, no fim) e devolve a nova posição. */
export function insertAtCursor(text: string, start: number | null, end: number | null, token: string): { text: string; cursor: number } {
  const s = start ?? text.length
  const e = end ?? s
  const next = text.slice(0, s) + token + text.slice(e)
  return { text: next, cursor: s + token.length }
}
