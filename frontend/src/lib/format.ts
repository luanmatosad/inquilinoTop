/**
 * pt-BR currency / date helpers used across the financial module.
 * Import from '@/lib/format' anywhere instead of re-inlining Intl.NumberFormat.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 2,
})

const DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const MONTH_SHORT = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: 'numeric',
})

const PCT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

export const fmtBRL = (n: number) => BRL.format(n)
export const fmtBRLCompact = (n: number) => BRL_COMPACT.format(n)
export const fmtDate = (d: string | Date) =>
  DATE.format(typeof d === 'string' ? new Date(d) : d)
export const fmtMonthShort = (d: string | Date) =>
  MONTH_SHORT.format(typeof d === 'string' ? new Date(d) : d)
export const fmtPct = (n: number) => PCT.format(n)
