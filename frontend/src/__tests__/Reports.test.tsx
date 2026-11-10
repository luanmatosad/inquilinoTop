import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
// O gráfico (recharts) não desenha no jsdom; a tabela escondida cobre o conteúdo.
vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
  ChartLegend: () => null,
  ChartLegendContent: () => null,
}))
vi.mock('recharts', () => ({ Bar: () => null, BarChart: ({ children }: { children: React.ReactNode }) => <>{children}</>, CartesianGrid: () => null, XAxis: () => null }))

import ReportsPage from '@/app/reports/page'
import ByPropertyPage from '@/app/reports/por-imovel/page'
import { GET as csvRoute } from '@/app/api/reports/por-imovel/route'

const months = Array.from({ length: 10 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, received: i === 9 ? 8300 : 0, expenses: i === 9 ? 1100 : 0 }))
const overview = { year: 2026, through_month: 10, months, totals: { received: 79250, expenses: 12200, result: 67050, payments_count: 40 } }
const byProperty = {
  year: 2026,
  through_month: 10,
  rows: [
    { unit_id: 'u4', received: 22000, expenses: 3200, result: 18800 },
    { unit_id: 'u1', received: 18500, expenses: 3100, result: 15400 },
  ],
  totals: { received: 40500, expenses: 6300, result: 34200 },
}
const properties = [
  { id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Ap 302' }] },
  { id: 'p4', name: 'Ed. Jasmim', units: [{ id: 'u4', label: 'Ap 12' }] },
]

function mockApi(o: { overview?: unknown; byProperty?: unknown; properties?: unknown } = {}) {
  const { overview: ov = overview, byProperty: bp = byProperty, properties: ps = properties } = o
  goFetch.mockImplementation(async (path: string) => {
    const v = path.startsWith('/api/v1/reports/overview') ? ov : path.startsWith('/api/v1/reports/by-property') ? bp : path === '/api/v1/properties' ? ps : undefined
    if (v === undefined) throw new Error('rota inesperada ' + path)
    if (v instanceof Error) throw v
    return v
  })
}
const hub = async (p: Record<string, string> = {}) => render(await ReportsPage({ searchParams: Promise.resolve(p) }))
const byProp = async (p: Record<string, string> = {}) => render(await ByPropertyPage({ searchParams: Promise.resolve(p) }))

beforeEach(() => {
  goFetch.mockReset()
  vi.setSystemTime(new Date('2026-11-08T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Relatórios: hub', () => {
  it('indicadores, período, gráfico e cards', async () => {
    mockApi()
    await hub()
    expect(screen.getByRole('heading', { name: 'Relatórios' })).toBeTruthy()
    expect(screen.getByText('Janeiro a outubro de 2026')).toBeTruthy()
    expect(screen.getByText(/79\.250,00/)).toBeTruthy()
    expect(screen.getByText(/67\.050,00/)).toBeTruthy()
    expect(screen.getByText('40 pagamentos')).toBeTruthy()
    expect(screen.getByTestId('chart')).toBeTruthy()
    expect(goFetch).toHaveBeenCalledWith('/api/v1/reports/overview?year=2026', {})
    expect(screen.getAllByRole('link', { name: /Abrir/ })[0].getAttribute('href')).toBe('/reports/por-imovel?ano=2026')
    expect(screen.getAllByRole('link', { name: /Abrir/ })[1].getAttribute('href')).toBe('/financial/receivables?situacao=LATE')
  })

  it('troca de ano pela URL', async () => {
    mockApi({ overview: { ...overview, year: 2025, through_month: 12 } })
    await hub({ ano: '2025' })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/reports/overview?year=2025', {})
    expect(screen.getByRole('link', { name: '2025' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByText('Janeiro a dezembro de 2025')).toBeTruthy()
  })

  it('janeiro: sem meses completos', async () => {
    mockApi({ overview: { year: 2026, through_month: 0, months: [], totals: { received: 0, expenses: 0, result: 0, payments_count: 0 } } })
    await hub()
    expect(screen.getByText(/Ainda não há meses completos/)).toBeTruthy()
    expect(screen.queryByTestId('chart')).toBeNull()
  })

  it('falha: mensagem e tentar de novo', async () => {
    mockApi({ overview: new Error('boom') })
    await hub()
    expect(screen.getByText('Não foi possível carregar os relatórios.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tentar novamente' }).getAttribute('href')).toBe('/reports?ano=2026')
  })
})

describe('Relatórios: por imóvel', () => {
  it('linhas com rótulo, total e exportação', async () => {
    mockApi()
    await byProp()
    expect(screen.getAllByText('Ap 12 · Ed. Jasmim').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ap 302 · Ed. Aurora').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/34\.200,00/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Exportar planilha/ }).getAttribute('href')).toBe('/api/reports/por-imovel?ano=2026')
  })

  it('imóveis fora do ar: traço e valores mantidos', async () => {
    mockApi({ properties: new Error('boom') })
    await byProp()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/22\.000,00/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Imóveis indisponíveis/)).toBeTruthy()
  })

  it('sem movimento: aviso e sem exportar', async () => {
    mockApi({ byProperty: { year: 2026, through_month: 10, rows: [], totals: { received: 0, expenses: 0, result: 0 } } })
    await byProp()
    expect(screen.getByText(/Nenhum recebimento ou despesa/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Exportar planilha/ })).toBeNull()
  })

  it('relatório fora do ar: mensagem', async () => {
    mockApi({ byProperty: new Error('boom') })
    await byProp()
    expect(screen.getByText('Não foi possível carregar os relatórios.')).toBeTruthy()
  })
})

describe('Relatórios: planilha', () => {
  it('devolve CSV com BOM, nome do arquivo e linhas', async () => {
    mockApi()
    const res = await csvRoute(new Request('http://localhost/api/reports/por-imovel?ano=2026'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('resultado-por-imovel-2026.csv')
    const bytes = new Uint8Array(await res.clone().arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]) // BOM UTF-8 (text() o descarta)
    const text = await res.text()
    expect(text).toContain('Ap 12 · Ed. Jasmim;22000,00;3200,00;18800,00')
    expect(text).toContain('Total;40500,00;6300,00;34200,00')
  })

  it('backend fora: 502 sem derrubar', async () => {
    mockApi({ byProperty: new Error('boom') })
    const res = await csvRoute(new Request('http://localhost/api/reports/por-imovel?ano=2026'))
    expect(res.status).toBe(502)
  })
})
