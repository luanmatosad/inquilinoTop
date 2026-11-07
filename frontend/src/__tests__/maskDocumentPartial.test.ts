import { describe, it, expect } from 'vitest'

import { maskDocumentPartial } from '@/lib/masks'

describe('maskDocumentPartial', () => {
  it('CPF: esconde os três dígitos do meio do bloco final', () => {
    expect(maskDocumentPartial('12345678909')).toBe('123.456.***-09')
    expect(maskDocumentPartial('123.456.789-09')).toBe('123.456.***-09')
  })

  it('CNPJ: esconde o final da raiz e mantém filial e dígitos', () => {
    expect(maskDocumentPartial('12345678000190')).toBe('12.345.***/0001-90')
    expect(maskDocumentPartial('12.345.678/0001-90')).toBe('12.345.***/0001-90')
  })

  it('o número completo nunca aparece no resultado', () => {
    expect(maskDocumentPartial('12345678909')).not.toContain('789')
  })

  it('vazio ou nulo: texto vazio', () => {
    expect(maskDocumentPartial('')).toBe('')
    expect(maskDocumentPartial(null)).toBe('')
    expect(maskDocumentPartial(undefined)).toBe('')
  })

  it('formato inesperado: esconde tudo em vez de arriscar mostrar', () => {
    expect(maskDocumentPartial('12345')).toBe('***')
  })
})
