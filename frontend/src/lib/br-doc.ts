import { onlyDigits } from './masks'

function allEqual(s: string): boolean {
  return s.split('').every((c) => c === s[0])
}

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0)
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11 || allEqual(d)) return false
  return (
    checkDigit(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) &&
    checkDigit(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10])
  )
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 14 || allEqual(d)) return false
  return (
    checkDigit(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) &&
    checkDigit(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13])
  )
}

/** PF valida CPF; PJ valida CNPJ. Espelha o backend (pkg/brdoc). */
export function isValidDocument(personType: 'PF' | 'PJ', value: string): boolean {
  return personType === 'PF' ? isValidCpf(value) : isValidCnpj(value)
}
