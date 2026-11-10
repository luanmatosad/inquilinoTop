import { describe, it, expect } from 'vitest'
import { defaultMonth, parseCarneMonth, canGoNext, statusBanner, categoryLabel, labelUnits, toCarneCsv, carneCsvFilename, type CarneLeao } from '@/lib/carne-leao'

const NOW = new Date('2026-11-08T15:00:00Z')

describe('mês', () => {
  it('padrão é o mês anterior em São Paulo', () => {
    expect(defaultMonth(NOW)).toBe('2026-10')
    expect(defaultMonth(new Date('2027-01-10T15:00:00Z'))).toBe('2026-12')
  })
  it('virada de mês usa São Paulo', () => {
    // 01/12 02:00 UTC ainda é 30/11 em São Paulo
    expect(defaultMonth(new Date('2026-12-01T02:00:00Z'))).toBe('2026-10')
  })
  it('parse: válido até o último mês encerrado, senão o padrão', () => {
    expect(parseCarneMonth('2026-05', NOW)).toBe('2026-05')
    expect(parseCarneMonth('2026-10', NOW)).toBe('2026-10')
    for (const m of ['2026-11', '2027-01', 'abc', '2026-13', '2019-12', undefined]) expect(parseCarneMonth(m, NOW)).toBe('2026-10')
  })
  it('próximo só até o último mês encerrado', () => {
    expect(canGoNext('2026-09', NOW)).toBe(true)
    expect(canGoNext('2026-10', NOW)).toBe(false)
  })
})

describe('statusBanner', () => {
  it('fechado: título e prazo', () => {
    const b = statusBanner('CLOSED', 'Outubro', '2026-11-30')
    expect(b.kind).toBe('closed')
    expect(b.title).toBe('Outubro está fechado')
    expect(b.text).toContain('30/11/2026')
    expect(b.text).toContain('programa da Receita')
  })
  it('aberto: avisa e aponta o Fechamento', () => {
    const b = statusBanner('OPEN', 'Outubro', '2026-11-30')
    expect(b.kind).toBe('open')
    expect(b.title).toBe('Outubro ainda não foi fechado')
    expect(b.text).toContain('Feche o mês')
  })
  it('sem informação do fechamento: só o aviso do cálculo', () => {
    const b = statusBanner(undefined, 'Outubro', '2026-11-30')
    expect(b.kind).toBe('none')
    expect(b.text).toContain('programa da Receita')
  })
})

describe('categoryLabel / labelUnits', () => {
  it('rótulos das categorias', () => {
    expect(categoryLabel('TAX')).toBe('Impostos')
    expect(categoryLabel('CONDO')).toBe('Condomínio')
    expect(categoryLabel('X')).toBe('X')
  })
  const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Ap 302' }] }]
  it('rótulo da unidade ou traço', () => {
    const r = labelUnits([{ unit_id: 'u1' }, { unit_id: 'zz' }], properties)
    expect(r.map((x) => x.label)).toEqual(['Ap 302 · Ed. Aurora', '—'])
  })
})

const carne: CarneLeao = {
  month: '2026-10',
  due_date: '2026-11-30',
  income: { total: 3450, count: 2, lines: [
    { payer: 'Marina Souza', unit_id: 'u1', paid_date: '2026-10-05', amount: 1850 },
    { payer: 'Carla; "Dias"', unit_id: 'u2', paid_date: '2026-10-02', amount: 1600 },
  ] },
  deductions: { total: 420, count: 1, lines: [{ description: 'IPTU · parcela 10', unit_id: 'u1', category: 'TAX', amount: 420 }] },
  base: 3030,
}

describe('toCarneCsv', () => {
  const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Ap 302' }] }]
  const lines = toCarneCsv(carne, properties).slice(1).split('\r\n')
  it('BOM e seções', () => {
    expect(toCarneCsv(carne, properties).startsWith('﻿')).toBe(true)
    expect(lines[0]).toBe('Rendimentos de aluguel')
    expect(lines[1]).toBe('Pagador;Imóvel;Recebido em;Valor')
    expect(lines[2]).toBe('Marina Souza;Ap 302 · Ed. Aurora;05/10/2026;1850,00')
    expect(lines[4]).toBe('Total;;;3450,00')
  })
  it('despesas e base', () => {
    expect(lines).toContain('Despesas que entram')
    expect(lines).toContain('IPTU · parcela 10;Ap 302 · Ed. Aurora;Impostos;420,00')
    expect(lines[lines.length - 1]).toBe('Base de cálculo (estimada);;;3030,00')
  })
  it('escapa ; e aspas', () => {
    expect(lines[3]).toBe('"Carla; ""Dias""";—;02/10/2026;1600,00')
  })
  it('nome do arquivo', () => expect(carneCsvFilename('2026-10')).toBe('carne-leao-2026-10.csv'))
})
