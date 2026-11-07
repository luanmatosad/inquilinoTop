import { describe, it, expect } from 'vitest'
import { valorPorExtenso } from '@/lib/valor-por-extenso'

describe('valorPorExtenso', () => {
  it.each([
    [0, 'zero reais'],
    [1, 'um real'],
    [2, 'dois reais'],
    [15, 'quinze reais'],
    [21, 'vinte e um reais'],
    [100, 'cem reais'],
    [101, 'cento e um reais'],
    [250, 'duzentos e cinquenta reais'],
    [1000, 'mil reais'],
    [1100, 'mil e cem reais'],
    [1850, 'mil oitocentos e cinquenta reais'],
    [2000, 'dois mil reais'],
    [2001, 'dois mil e um reais'],
    [2500, 'dois mil e quinhentos reais'],
    [12345, 'doze mil trezentos e quarenta e cinco reais'],
    [100000, 'cem mil reais'],
    [1000000, 'um milhão de reais'],
    [1200000, 'um milhão e duzentos mil reais'],
    [2000000, 'dois milhões de reais'],
  ])('%s → %s', (n, expected) => expect(valorPorExtenso(n)).toBe(expected))

  it('centavos', () => {
    expect(valorPorExtenso(1585.13)).toBe('mil quinhentos e oitenta e cinco reais e treze centavos')
    expect(valorPorExtenso(0.5)).toBe('cinquenta centavos')
    expect(valorPorExtenso(0.01)).toBe('um centavo')
    expect(valorPorExtenso(1.01)).toBe('um real e um centavo')
  })

  it('arredonda para centavos sem deriva', () => {
    expect(valorPorExtenso(0.1 + 0.2)).toBe('trinta centavos')
  })

  it('inválidos viram zero', () => {
    expect(valorPorExtenso(NaN)).toBe('zero reais')
    expect(valorPorExtenso(-5)).toBe('zero reais')
  })
})
