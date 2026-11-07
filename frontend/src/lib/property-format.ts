// Formatadores de exibição de imóvel (rótulos, endereço composto e "desde MM/AAAA").

const TYPE_LABELS: Record<string, string> = {
  RESIDENTIAL: 'Residencial',
  COMMERCIAL: 'Comercial',
  SINGLE: 'Casa',
}

export function propertyTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? 'Desconhecido'
}

export type AddressParts = {
  address_line?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
}

const clean = (v?: string | null) => v?.trim() ?? ''

/** "Rua Quinze, 120 - Bloco B · Centro, Itacoatiara/AM". `short` omite complemento e cidade (celular). */
export function formatPropertyAddress(a: AddressParts, opts: { short?: boolean } = {}): string {
  const number = clean(a.number)
  const complement = clean(a.complement)
  let street = [clean(a.address_line), number].filter(Boolean).join(', ')
  if (complement && !opts.short) street = street ? `${street} - ${complement}` : complement

  const cityState = [clean(a.city), clean(a.state)].filter(Boolean).join('/')
  const place = opts.short ? clean(a.neighborhood) : [clean(a.neighborhood), cityState].filter(Boolean).join(', ')

  return [street, place].filter(Boolean).join(' · ')
}

/** "2025-03-10" → "desde 03/2025". Lê a string direto para não depender de fuso horário. */
export function formatSince(iso?: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})/)
  return m ? `desde ${m[2]}/${m[1]}` : ''
}

/** Texto de ocupação da lista: "1 de 3 alugadas" (vários) ou "Alugada"/"Vaga" (Casa). */
export function occupancyLabel(type: string, o: { total: number; rented: number }): string {
  if (o.total === 0) return 'Sem unidades'
  if (type === 'SINGLE') return o.rented > 0 ? 'Alugada' : 'Vaga'
  return `${o.rented} de ${o.total} ${o.total === 1 ? 'alugada' : 'alugadas'}`
}

/** "1 imóvel" / "0 imóveis" / "14 unidades": singular só para 1. */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}
