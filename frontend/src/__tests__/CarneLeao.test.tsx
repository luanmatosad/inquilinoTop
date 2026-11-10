import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import CarneLeaoPage from '@/app/reports/carne-leao/page'
import { GET as csvRoute } from '@/app/api/reports/carne-leao/route'

const carne = {
  month: '2026-10',
  due_date: '2026-11-30',
  income: {
    total: 8300,
    count: 5,
    lines: [
      { payer: 'Carla Dias', unit_id: 'u4', paid_date: '2026-10-02', amount: 2200 },
      { payer: 'Marina Souza', unit_id: 'u1', paid_date: '2026-10-05', amount: 1850 },
    ],
  },
  deductions: {
    total: 1100,
    count: 2,
    lines: [
      { description: 'Condomínio de outubro', unit_id: 'u4', category: 'CONDO', amount: 680 },
      { description: 'IPTU · parcela 10', unit_id: 'u1', category: 'TAX', amount: 420 },
    ],
  },
  base: 7200,
}
const properties = [
  { id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Ap 302' }] },
  { id: 'p4', name: 'Ed. Jasmim', units: [{ id: 'u4', label: 'Ap 12' }] },
]
const closed = { month: '2026-10', status: 'CLOSED', snapshot: {}, events: [] }
const open = { month: '2026-10', status: 'OPEN', snapshot: {}, events: [] }

function mockApi(o: { carne?: unknown; properties?: unknown; closing?: unknown } = {}) {
  const { carne: c = carne, properties: ps = properties, closing = closed } = o
  goFetch.mockImplementation(async (path: string) => {
    const v = path.startsWith('/api/v1/reports/carne-leao') ? c : path === '/api/v1/properties' ? ps : path.startsWith('/api/v1/closings') ? closing : undefined
    if (v === undefined) throw new Error('rota inesperada ' + path)
    if (v instanceof Error) throw v
    return v
  })
}
const page = async (p: Record<string, string> = {}) => render(await CarneLeaoPage({ searchParams: Promise.resolve(p) }))

beforeEach(() => {
  goFetch.mockReset()
  vi.setSystemTime(new Date('2026-11-08T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Carnê-leão: tela', () => {
  it('mês fechado: faixa com prazo, totais e listas', async () => {
    mockApi()
    await page()
    expect(goFetch).toHaveBeenCalledWith('/api/v1/reports/carne-leao?month=2026-10', {})
    expect(screen.getByRole('heading', { name: 'Carnê-leão e DIRPF' })).toBeTruthy()
    expect(screen.getByText('Outubro está fechado')).toBeTruthy()
    expect(screen.getAllByText(/30\/11\/2026/).length).toBeGreaterThan(0)
    expect(screen.getByText('Rendimentos de aluguel')).toBeTruthy()
    expect(screen.getByText(/8\.300,00/)).toBeTruthy()
    expect(screen.getByText(/7\.200,00/)).toBeTruthy()
    expect(screen.getByText('5 pagamentos recebidos')).toBeTruthy()
    expect(screen.getAllByText('Ap 302 · Ed. Aurora').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Condomínio').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Impostos').length).toBeGreaterThan(0)
  })

  it('mês aberto: avisa e leva ao Fechamento', async () => {
    mockApi({ closing: open })
    await page()
    expect(screen.getByText('Outubro ainda não foi fechado')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir para o Fechamento' }).getAttribute('href')).toBe('/financial/receivables/fechamento?mes=2026-10')
  })

  it('fechamento indisponível: só o aviso do cálculo', async () => {
    mockApi({ closing: new Error('boom') })
    await page()
    expect(screen.queryByText(/está fechado|ainda não foi fechado/)).toBeNull()
    expect(screen.getByText(/programa da Receita/)).toBeTruthy()
  })

  it('navegação de mês: anterior e próximo desabilitado no último mês', async () => {
    mockApi()
    await page()
    expect(screen.getByRole('link', { name: 'Mês anterior' }).getAttribute('href')).toBe('/reports/carne-leao?mes=2026-09')
    expect((screen.getByRole('button', { name: 'Próximo mês' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('mês anterior permite avançar; mês inválido cai no último encerrado', async () => {
    mockApi()
    await page({ mes: '2026-05' })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/reports/carne-leao?month=2026-05', {})
    expect(screen.getByRole('link', { name: 'Próximo mês' }).getAttribute('href')).toBe('/reports/carne-leao?mes=2026-06')
  })

  it('mês corrente na URL cai no último encerrado', async () => {
    mockApi()
    await page({ mes: '2026-11' })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/reports/carne-leao?month=2026-10', {})
  })

  it('sem movimento: avisos vazios e base zero', async () => {
    mockApi({ carne: { ...carne, income: { total: 0, count: 0, lines: [] }, deductions: { total: 0, count: 0, lines: [] }, base: 0 } })
    await page()
    expect(screen.getByText(/Nenhum aluguel de pessoa física/)).toBeTruthy()
    expect(screen.getByText(/Nenhuma despesa dessas categorias/)).toBeTruthy()
  })

  it('imóveis fora do ar: traço e aviso', async () => {
    mockApi({ properties: new Error('boom') })
    await page()
    expect(screen.getByText(/Imóveis indisponíveis/)).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('relatório fora do ar: mensagem e tentar de novo', async () => {
    mockApi({ carne: new Error('boom') })
    await page()
    expect(screen.getByText('Não foi possível carregar o relatório.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tentar novamente' }).getAttribute('href')).toBe('/reports/carne-leao?mes=2026-10')
  })

  it('ações: Baixar para o contador e Exportar planilha', async () => {
    mockApi()
    await page()
    expect(screen.getByRole('button', { name: /Baixar para o contador/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Exportar planilha/ }).getAttribute('href')).toBe('/api/reports/carne-leao?mes=2026-10')
    const cards = screen.getByRole('region', { name: 'Totais' })
    expect(within(cards).getAllByText(/R\$/).length).toBe(3)
  })
})

describe('Carnê-leão: planilha', () => {
  it('CSV com BOM, nome e as duas listas', async () => {
    mockApi()
    const res = await csvRoute(new Request('http://localhost/api/reports/carne-leao?mes=2026-10'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('carne-leao-2026-10.csv')
    const bytes = new Uint8Array(await res.clone().arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = await res.text()
    expect(text).toContain('Marina Souza;Ap 302 · Ed. Aurora;05/10/2026;1850,00')
    expect(text).toContain('IPTU · parcela 10;Ap 302 · Ed. Aurora;Impostos;420,00')
    expect(text).toContain('Base de cálculo (estimada);;;7200,00')
  })

  it('backend fora: 502', async () => {
    mockApi({ carne: new Error('boom') })
    const res = await csvRoute(new Request('http://localhost/api/reports/carne-leao?mes=2026-10'))
    expect(res.status).toBe(502)
  })
})
