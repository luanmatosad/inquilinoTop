import { describe, it, expect } from 'vitest'
import { safeNextPath } from '@/lib/safe-next'

describe('safeNextPath', () => {
  it('mantém caminho interno com query', () => {
    expect(safeNextPath('/invite/accept?token=abc')).toBe('/invite/accept?token=abc')
  })

  it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'evil.com', ''])(
    'rejeita destino externo ou inválido (%s) e volta ao painel',
    (value) => {
      expect(safeNextPath(value)).toBe('/')
    },
  )

  it('sem valor volta ao painel', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
  })
})
