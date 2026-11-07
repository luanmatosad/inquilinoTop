import { onlyDigits } from '@/lib/masks'

/** Link `wa.me` do celular BR, ou `null` se o número não parecer válido (menos de 10 dígitos). */
export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  const d = onlyDigits(phone)
  let base: string | null = null
  if (d.length === 10 || d.length === 11) base = `https://wa.me/55${d}`
  // Já com o código do país (55 + DDD + número).
  else if ((d.length === 12 || d.length === 13) && d.startsWith('55')) base = `https://wa.me/${d}`
  if (!base) return null
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
