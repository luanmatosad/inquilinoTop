import { parseDecimal } from './form-utils'

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d
const num = (v: number | string | null | undefined) => {
  const n = typeof v === 'string' ? parseDecimal(v) : (v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** % ao mês (como o usuário digita) → % ao dia que o backend guarda (÷30, 6 casas). */
export const monthlyToDaily = (m: number | string | null | undefined) => round(num(m) / 30, 6)

/** % ao dia do backend → % ao mês exibido (×30, 2 casas). */
export const dailyToMonthly = (d: number | string | null | undefined) => round(num(d) * 30, 2)
