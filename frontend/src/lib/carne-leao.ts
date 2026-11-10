// Carnê-leão (spec reports-carne-leao): mês, faixa de estado, rótulos e CSV. Os números vêm do backend.
import { formatDateBR } from './date-format'
import { shiftMonth } from './financial-overview'
import { todaySaoPaulo } from './lease-overview'
import { labelUnits } from './report-overview'

export { labelUnits }

export type IncomeLine = { payer: string; unit_id: string; paid_date: string; amount: number }
export type DeductionLine = { description: string; unit_id: string; category: string; amount: number }
export type CarneLeao = {
  month: string
  due_date: string
  income: { total: number; count: number; lines: IncomeLine[] }
  deductions: { total: number; count: number; lines: DeductionLine[] }
  base: number
}

/** O último mês encerrado: o anterior ao corrente em São Paulo. */
export const defaultMonth = (now: Date = new Date()) => shiftMonth(todaySaoPaulo(now).slice(0, 7), -1)

/** `?mes=AAAA-MM` entre 2020 e o último mês encerrado; o resto cai no último mês encerrado. */
export function parseCarneMonth(mes: string | undefined, now: Date = new Date()): string {
  const last = defaultMonth(now)
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && mes >= '2020-01' && mes <= last ? mes : last
}

export const canGoNext = (ym: string, now: Date = new Date()) => ym < defaultMonth(now)

const CALC_NOTE = 'O ImoviFlow organiza os números; o cálculo do imposto é feito no programa da Receita ou com seu contador.'

export type Banner = { kind: 'closed' | 'open' | 'none'; title: string; text: string }

/** Faixa do topo: depende de o mês estar fechado no Fechamento. Sem a informação, só o aviso do cálculo. */
export function statusBanner(status: 'OPEN' | 'CLOSED' | undefined, monthName: string, dueDate: string): Banner {
  const due = formatDateBR(dueDate)
  if (status === 'CLOSED') {
    return { kind: 'closed', title: `${monthName} está fechado`, text: `Se houver imposto a pagar, o prazo estimado é ${due}. ${CALC_NOTE}` }
  }
  if (status === 'OPEN') {
    return {
      kind: 'open',
      title: `${monthName} ainda não foi fechado`,
      text: `Feche o mês para conferir antes de enviar ao contador. Se houver imposto a pagar, o prazo estimado é ${due}. ${CALC_NOTE}`,
    }
  }
  return { kind: 'none', title: '', text: CALC_NOTE }
}

const CATEGORY: Record<string, string> = { TAX: 'Impostos', CONDO: 'Condomínio' }
export const categoryLabel = (c: string) => CATEGORY[c] ?? c

const num = (n: number) => n.toFixed(2).replace('.', ',')
const cell = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
const row = (...cols: string[]) => cols.map(cell).join(';')

type Property = { id: string; name: string; units?: { id: string; label: string }[] | null }

/** CSV para Excel em pt-BR (BOM, `;`, vírgula decimal): rendimentos, despesas que entram e a base. */
export function toCarneCsv(c: CarneLeao, properties: Property[]): string {
  const income = labelUnits(c.income.lines, properties)
  const deductions = labelUnits(c.deductions.lines, properties)
  const lines = [
    'Rendimentos de aluguel',
    'Pagador;Imóvel;Recebido em;Valor',
    ...income.map((l) => row(l.payer, l.label, formatDateBR(l.paid_date), num(l.amount))),
    row('Total', '', '', num(c.income.total)),
    '',
    'Despesas que entram',
    'Despesa;Imóvel;Categoria;Valor',
    ...deductions.map((l) => row(l.description, l.label, categoryLabel(l.category), num(l.amount))),
    row('Total', '', '', num(c.deductions.total)),
    '',
    row('Base de cálculo (estimada)', '', '', num(c.base)),
  ]
  return '﻿' + lines.join('\r\n')
}

export const carneCsvFilename = (ym: string) => `carne-leao-${ym}.csv`
