import { describe, it, expect } from 'vitest'

import { formatDateBR, monthName } from '@/lib/date-format'

describe('monthName', () => {
  it.each([
    ['2026-01-10', 'Janeiro'],
    ['2026-03-01', 'Março'],
    ['2026-11-05', 'Novembro'],
    ['2026-12-31T23:00:00Z', 'Dezembro'],
  ])('%s → %s', (iso, expected) => {
    expect(monthName(iso)).toBe(expected)
  })

  it('inválido: vazio', () => {
    expect(monthName('nao-e-data')).toBe('')
    expect(monthName(null)).toBe('')
  })
})

describe('formatDateBR', () => {
  it('ISO vira dd/mm/aaaa sem depender de fuso', () => {
    expect(formatDateBR('2026-11-05')).toBe('05/11/2026')
    expect(formatDateBR('2026-11-05T00:00:00Z')).toBe('05/11/2026')
  })

  it('inválido: vazio', () => {
    expect(formatDateBR(undefined)).toBe('')
    expect(formatDateBR('x')).toBe('')
  })
})
