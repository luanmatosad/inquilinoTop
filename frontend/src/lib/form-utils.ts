// Helpers compartilhados pelos schemas de formulário. O backend (Go) exige datas em RFC3339.

/** "1500,50" e "1500.50" valem; "1.500,50" (milhar) não. Retorna NaN se inválido. */
export function parseDecimal(v: string): number {
  const s = v.trim()
  if (!/^\d+([.,]\d+)?$/.test(s)) return NaN
  return Number(s.replace(",", "."))
}

/** "2026-01-01" -> "2026-01-01T00:00:00Z". */
export function toRfc3339(date: string): string {
  return `${date}T00:00:00Z`
}

/** Remove chaves vazias para o backend tratar como "não informado". */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as Partial<T>
}
