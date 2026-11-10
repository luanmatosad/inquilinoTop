// Relatórios (specs reports-overview e reports-by-property): ano, rótulos, linhas por imóvel e CSV.
// Os números vêm calculados do backend (base de caixa, por data de pagamento); aqui só se apresenta.
import { MONTHS } from './date-format'
import { todaySaoPaulo } from './lease-overview'

export const FIRST_YEAR = 2020

export type MonthRow = { month: string; received: number; expenses: number }
export type Totals = { received: number; expenses: number; result: number; payments_count?: number }
export type Overview = { year: number; through_month: number; months: MonthRow[]; totals: Totals }
export type UnitApiRow = { unit_id: string; received: number; expenses: number; result: number }
export type ByProperty = { year: number; through_month: number; rows: UnitApiRow[]; totals: Totals }
export type UnitRow = UnitApiRow & { label: string }

const currentYear = (now: Date) => Number(todaySaoPaulo(now).slice(0, 4))

/** `?ano=AAAA` entre 2020 e o ano corrente; o resto cai no ano corrente (São Paulo). */
export function parseYear(ano: string | undefined, now: Date = new Date()): number {
  const cur = currentYear(now)
  const n = ano && /^\d{4}$/.test(ano) ? Number(ano) : NaN
  return n >= FIRST_YEAR && n <= cur ? n : cur
}

export function yearOptions(now: Date = new Date()): number[] {
  const cur = currentYear(now)
  return Array.from({ length: cur - FIRST_YEAR + 1 }, (_, i) => cur - i)
}

/** "Janeiro a outubro de 2026" (janeiro ao último mês completo). */
export function periodLabel(year: number, through: number): string {
  if (through <= 0) return `Ainda sem meses completos em ${year}`
  if (through === 1) return `Janeiro de ${year}`
  return `Janeiro a ${MONTHS[through - 1].toLowerCase()} de ${year}`
}

export const monthShort = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1].slice(0, 3)

type Property = { id: string; name: string; units?: { id: string; label: string }[] | null }

/** Acrescenta "Unidade · Imóvel" (ou "—") a cada linha. */
export function buildUnitRows(rows: UnitApiRow[], properties: Property[]): UnitRow[] {
  const index = new Map<string, string>()
  for (const p of properties) for (const u of p.units ?? []) index.set(u.id, `${u.label} · ${p.name}`)
  return rows.map((r) => ({ ...r, label: index.get(r.unit_id) ?? '—' }))
}

const num = (n: number) => n.toFixed(2).replace('.', ',')
const cell = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** CSV para Excel em pt-BR: BOM, separador `;`, vírgula decimal, linha final de total. */
export function toCsv(rows: UnitRow[], totals: Pick<Totals, 'received' | 'expenses' | 'result'>): string {
  const line = (label: string, r: { received: number; expenses: number; result: number }) =>
    [cell(label), num(r.received), num(r.expenses), num(r.result)].join(';')
  return '﻿' + ['Imóvel;Recebido;Despesas;Resultado', ...rows.map((r) => line(r.label, r)), line('Total', totals)].join('\r\n')
}

export const csvFilename = (year: number) => `resultado-por-imovel-${year}.csv`
