import { describe, it, expect } from 'vitest'

import {
  formatPropertyAddress,
  formatSince,
  occupancyLabel,
  plural,
  propertyTypeLabel,
} from '@/lib/property-format'

describe('propertyTypeLabel', () => {
  it.each([
    ['RESIDENTIAL', 'Residencial'],
    ['COMMERCIAL', 'Comercial'],
    ['SINGLE', 'Casa'],
    ['OUTRO', 'Desconhecido'],
  ])('%s → %s', (type, label) => {
    expect(propertyTypeLabel(type)).toBe(label)
  })
})

describe('formatPropertyAddress', () => {
  const aurora = {
    address_line: 'Rua Quinze',
    number: '120',
    neighborhood: 'Centro',
    city: 'Itacoatiara',
    state: 'AM',
  }

  it('compõe logradouro, número, bairro e cidade/UF como no canvas', () => {
    expect(formatPropertyAddress(aurora)).toBe('Rua Quinze, 120 · Centro, Itacoatiara/AM')
  })

  it('acrescenta o complemento depois do número', () => {
    expect(formatPropertyAddress({ ...aurora, complement: 'Bloco B' })).toBe(
      'Rua Quinze, 120 - Bloco B · Centro, Itacoatiara/AM',
    )
  })

  it('sem número: só o logradouro', () => {
    expect(formatPropertyAddress({ ...aurora, number: null })).toBe(
      'Rua Quinze · Centro, Itacoatiara/AM',
    )
  })

  it('versão curta (celular): logradouro, número e bairro', () => {
    expect(formatPropertyAddress(aurora, { short: true })).toBe('Rua Quinze, 120 · Centro')
  })

  it('cidade sem UF e UF sem cidade', () => {
    expect(formatPropertyAddress({ city: 'Manaus' })).toBe('Manaus')
    expect(formatPropertyAddress({ state: 'AM' })).toBe('AM')
  })

  it('sem nenhum dado: texto vazio', () => {
    expect(formatPropertyAddress({})).toBe('')
  })

  it('ignora campos em branco', () => {
    expect(formatPropertyAddress({ address_line: ' ', number: '', city: 'Manaus' })).toBe('Manaus')
  })
})

describe('formatSince', () => {
  it('data ISO vira "desde MM/AAAA"', () => {
    expect(formatSince('2025-03-10')).toBe('desde 03/2025')
    expect(formatSince('2025-03-10T00:00:00Z')).toBe('desde 03/2025')
  })

  it('sem data ou inválida: vazio', () => {
    expect(formatSince(null)).toBe('')
    expect(formatSince(undefined)).toBe('')
    expect(formatSince('nao-e-data')).toBe('')
  })
})

describe('occupancyLabel', () => {
  it('imóvel de várias unidades: "N de M alugadas"', () => {
    expect(occupancyLabel('RESIDENTIAL', { total: 3, rented: 1 })).toBe('1 de 3 alugadas')
    expect(occupancyLabel('COMMERCIAL', { total: 4, rented: 0 })).toBe('0 de 4 alugadas')
  })

  it('Casa: "Alugada" ou "Vaga"', () => {
    expect(occupancyLabel('SINGLE', { total: 1, rented: 1 })).toBe('Alugada')
    expect(occupancyLabel('SINGLE', { total: 1, rented: 0 })).toBe('Vaga')
  })

  it('sem unidades', () => {
    expect(occupancyLabel('RESIDENTIAL', { total: 0, rented: 0 })).toBe('Sem unidades')
  })

  it('uma única unidade em imóvel multiunidade: singular', () => {
    expect(occupancyLabel('RESIDENTIAL', { total: 1, rented: 1 })).toBe('1 de 1 alugada')
    expect(occupancyLabel('COMMERCIAL', { total: 1, rented: 0 })).toBe('0 de 1 alugada')
  })
})

describe('plural', () => {
  it('singular só para 1; zero e os demais no plural', () => {
    expect(plural(1, 'imóvel', 'imóveis')).toBe('1 imóvel')
    expect(plural(0, 'imóvel', 'imóveis')).toBe('0 imóveis')
    expect(plural(14, 'unidade', 'unidades')).toBe('14 unidades')
  })
})
