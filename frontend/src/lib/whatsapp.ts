import { onlyDigits } from '@/lib/masks'

/** Link `wa.me` do celular BR, ou `null` se o número não parecer válido (menos de 10 dígitos). */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const d = onlyDigits(phone)
  if (d.length === 10 || d.length === 11) return `https://wa.me/55${d}`
  // Já com o código do país (55 + DDD + número).
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return `https://wa.me/${d}`
  return null
}
