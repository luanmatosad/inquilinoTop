import { describe, it, expect } from 'vitest'
import { parseYear, yearOptions, periodLabel, monthShort, buildUnitRows, toCsv, csvFilename } from '@/lib/report-overview'

const NOW = new Date('2026-11-08T15:00:00Z')

describe('parseYear / yearOptions', () => {
  it('padrão é o ano corrente em São Paulo', () => {
    expect(parseYear(undefined, NOW)).toBe(2026)
    expect(parseYear('2025', NOW)).toBe(2025)
  })
  it('fora da faixa ou inválido volta ao corrente', () => {
    for (const v of ['2027', '2019', 'abc', '']) expect(parseYear(v, NOW)).toBe(2026)
  })
  it('virada de ano usa São Paulo', () => {
    expect(parseYear(undefined, new Date('2027-01-01T02:00:00Z'))).toBe(2026)
  })
  it('opções do corrente até 2020', () => {
    expect(yearOptions(NOW)).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020])
  })
})

describe('periodLabel', () => {
  it('janeiro ao último mês completo', () => {
    expect(periodLabel(2026, 10)).toBe('Janeiro a outubro de 2026')
    expect(periodLabel(2025, 12)).toBe('Janeiro a dezembro de 2025')
  })
  it('um mês e nenhum', () => {
    expect(periodLabel(2026, 1)).toBe('Janeiro de 2026')
    expect(periodLabel(2026, 0)).toBe('Ainda sem meses completos em 2026')
  })
})

describe('monthShort', () => {
  it('abreviação em português', () => {
    expect(monthShort('2026-01')).toBe('Jan')
    expect(monthShort('2026-10')).toBe('Out')
  })
})

const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Ap 302' }] }]
const rows = [
  { unit_id: 'u1', received: 18500, expenses: 3100, result: 15400 },
  { unit_id: 'ux', received: 100, expenses: 0, result: 100 },
]

describe('buildUnitRows', () => {
  it('rótulo "Unidade · Imóvel" e traço quando desconhecido', () => {
    const r = buildUnitRows(rows, properties)
    expect(r[0].label).toBe('Ap 302 · Ed. Aurora')
    expect(r[1].label).toBe('—')
  })
  it('sem imóveis: tudo traço, valores mantidos', () => {
    const r = buildUnitRows(rows, [])
    expect(r.map((x) => x.label)).toEqual(['—', '—'])
    expect(r[0].received).toBe(18500)
  })
})

describe('toCsv', () => {
  it('BOM, separador ; e vírgula decimal, com total', () => {
    const csv = toCsv(buildUnitRows(rows, properties), { received: 18600, expenses: 3100, result: 15500 })
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('Imóvel;Recebido;Despesas;Resultado')
    expect(lines[1]).toBe('Ap 302 · Ed. Aurora;18500,00;3100,00;15400,00')
    expect(lines[3]).toBe('Total;18600,00;3100,00;15500,00')
  })
  it('escapa ; e aspas no rótulo', () => {
    const csv = toCsv([{ unit_id: 'u', label: 'Casa; "Fundos"', received: 1, expenses: 0, result: 1 }], { received: 1, expenses: 0, result: 1 })
    expect(csv).toContain('"Casa; ""Fundos"""')
  })
})

describe('csvFilename', () => {
  it('inclui o ano', () => expect(csvFilename(2026)).toBe('resultado-por-imovel-2026.csv'))
})
