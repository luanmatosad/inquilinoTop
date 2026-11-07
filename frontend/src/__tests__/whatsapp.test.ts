import { describe, it, expect } from 'vitest'

import { whatsappUrl } from '@/lib/whatsapp'

describe('whatsappUrl', () => {
  it('celular com máscara', () => {
    expect(whatsappUrl('(11) 98888-1111')).toBe('https://wa.me/5511988881111')
  })

  it('só dígitos, 11 dígitos', () => {
    expect(whatsappUrl('11988881111')).toBe('https://wa.me/5511988881111')
  })

  it('fixo de 10 dígitos', () => {
    expect(whatsappUrl('1133334444')).toBe('https://wa.me/551133334444')
  })

  it('já com 55 não duplica o prefixo', () => {
    expect(whatsappUrl('5511988881111')).toBe('https://wa.me/5511988881111')
    expect(whatsappUrl('+55 (11) 98888-1111')).toBe('https://wa.me/5511988881111')
  })

  it('DDD 55 (RS) com 11 dígitos ganha o prefixo normalmente', () => {
    expect(whatsappUrl('55988881111')).toBe('https://wa.me/5555988881111')
  })

  it.each([null, undefined, '', '123', '(11) 9888', 'abc'])('inválido (%s): sem link', (v) => {
    expect(whatsappUrl(v)).toBeNull()
  })
})
