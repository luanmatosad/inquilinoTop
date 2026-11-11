// Pix das Configurações (spec pix-settings): tipos de chave, validação espelhada do backend, máscara e dedução do tipo.
// O backend (`internal/settings`) é quem vale; aqui só se avisa cedo e se mostra a chave com discrição.
import { isValidCnpj, isValidCpf } from './br-doc'

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'

export const PIX_KEY_TYPES: { value: PixKeyType; label: string; placeholder: string }[] = [
  { value: 'CPF', label: 'CPF', placeholder: '000.000.000-00' },
  { value: 'CNPJ', label: 'CNPJ', placeholder: '00.000.000/0000-00' },
  { value: 'EMAIL', label: 'E-mail', placeholder: 'voce@email.com' },
  { value: 'PHONE', label: 'Celular', placeholder: '(00) 00000-0000' },
  { value: 'RANDOM', label: 'Chave aleatória', placeholder: '123e4567-e89b-12d3-a456-426614174000' },
]

const MAX_RECEIVER_NAME = 25
const MAX_PIX_CITY = 15

const digits = (s: string) => s.replace(/\D/g, '')
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const runes = (s: string) => Array.from(s).length

export type KeyResult = { ok: true; value: string } | { ok: false; error: string }

/** Confere a chave para o tipo e devolve a forma gravada (igual à do backend). */
export function normalizePixKey(type: PixKeyType, raw: string): KeyResult {
  const key = raw.trim()
  const bad = (error: string): KeyResult => ({ ok: false, error })
  switch (type) {
    case 'CPF': {
      const d = digits(key)
      return isValidCpf(d) ? { ok: true, value: d } : bad('CPF inválido. Confira os 11 dígitos.')
    }
    case 'CNPJ': {
      const d = digits(key)
      return isValidCnpj(d) ? { ok: true, value: d } : bad('CNPJ inválido. Confira os 14 dígitos.')
    }
    case 'EMAIL': {
      const e = key.toLowerCase()
      return e.length <= 77 && EMAIL.test(e) ? { ok: true, value: e } : bad('E-mail inválido.')
    }
    case 'PHONE': {
      const d = digits(key)
      const phoneError = bad('Celular inválido. Use DDD e número, só do Brasil.')
      if (key.startsWith('+') && !d.startsWith('55')) return phoneError
      if (d.length === 10 || d.length === 11) return { ok: true, value: `+55${d}` }
      if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return { ok: true, value: `+${d}` }
      return phoneError
    }
    case 'RANDOM': {
      const u = key.toLowerCase()
      return UUID.test(u) ? { ok: true, value: u } : bad('Chave aleatória inválida. Cole a chave completa (formato 8-4-4-4-12).')
    }
  }
}

const cnpjMask = (d: string) => `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`

/** Como a chave aparece nas listas: CPF e celular mascarados, CNPJ e e-mail inteiros (como no canvas). */
export function maskPixKey(type: PixKeyType, key: string): string {
  switch (type) {
    case 'CPF':
      return `CPF ···.${key.slice(6, 9)}-${key.slice(9, 11)}`
    case 'CNPJ':
      return `CNPJ ${cnpjMask(key)}`
    case 'EMAIL':
      return `E-mail ${key}`
    case 'PHONE': {
      const d = key.replace(/^\+55/, '')
      return `Celular (${d.slice(0, 2)}) ·····-${d.slice(-4)}`
    }
    case 'RANDOM':
      return `Chave ${key.slice(0, 8)}…${key.slice(-4)}`
  }
}

/** Dedução do tipo de uma chave antiga (gravada sem tipo); `null` se o formato não deixa claro. */
export function inferKeyType(key: string): PixKeyType | null {
  const k = key.trim()
  if (!k) return null
  if (EMAIL.test(k)) return 'EMAIL'
  if (UUID.test(k.toLowerCase())) return 'RANDOM'
  const d = digits(k)
  if (d.length === 14 && isValidCnpj(d)) return 'CNPJ'
  if (d.length === 11 && isValidCpf(d)) return 'CPF'
  const compact = k.replace(/\s/g, '')
  if (/^\+55\d{10,11}$/.test(compact)) return 'PHONE'
  if ((d.length === 10 || d.length === 11) && /^[\d\s()-]+$/.test(k)) return 'PHONE'
  return null
}

export type PixFormInput = { key_type: string; key: string; receiver_name: string; city: string }
type PixFormValue = { key_type: PixKeyType; key: string; receiver_name: string; city: string }
export type PixParseResult = { ok: true; value: PixFormValue } | { ok: false; errors: Partial<Record<keyof PixFormInput, string>> }

export function parsePixForm(raw: PixFormInput): PixParseResult {
  const errors: Partial<Record<keyof PixFormInput, string>> = {}
  const type = PIX_KEY_TYPES.find((t) => t.value === raw.key_type)?.value
  const name = raw.receiver_name.trim()
  const city = raw.city.trim()
  let key = ''
  if (!type) errors.key_type = 'Escolha o tipo da chave.'
  else {
    const k = normalizePixKey(type, raw.key)
    if (k.ok) key = k.value
    else errors.key = k.error
  }
  if (runes(name) > MAX_RECEIVER_NAME) errors.receiver_name = `O nome vai até ${MAX_RECEIVER_NAME} caracteres.`
  if (runes(city) > MAX_PIX_CITY) errors.city = `A cidade vai até ${MAX_PIX_CITY} caracteres.`
  if (Object.keys(errors).length || !type) return { ok: false, errors }
  return { ok: true, value: { key_type: type, key, receiver_name: name, city } }
}

// ---------- Tipos da API (`GET /settings/pix`) ----------

export type PixDefault = { configured: boolean; key_type?: PixKeyType; key?: string; receiver_name?: string; city?: string }
export type UnitPix = { unit_id: string; key_type: PixKeyType; key: string; receiver_name?: string; confirmed_at: string }
export type PixSettings = { default: PixDefault; units: UnitPix[] }
