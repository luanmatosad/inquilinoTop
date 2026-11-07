export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const parts = (iso?: string | null) => iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)

/** "2026-11-05" → "Novembro". Lê a string direto, sem converter para Date, para não depender de fuso. */
export function monthName(iso?: string | null): string {
  const m = parts(iso)
  return m ? (MONTHS[Number(m[2]) - 1] ?? '') : ''
}

/** "2026-11-05" → "05/11/2026". */
export function formatDateBR(iso?: string | null): string {
  const m = parts(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** "2027-03-01T00:00:00Z" → "03/2027"; vazio → "—". */
export function formatMonthYear(iso?: string | null): string {
  const m = parts(iso)
  return m ? `${m[2]}/${m[1]}` : '—'
}
