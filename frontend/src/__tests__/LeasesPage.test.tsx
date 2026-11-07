import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('@/app/leases/actions', () => ({ createLease: vi.fn(), updateLease: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/leases',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import LeasesPage from '@/app/leases/page'

const lease = (id: string, tenant_id: string, unit_id: string, extra = {}) => ({
  id, tenant_id, unit_id, status: 'ACTIVE', start_date: '2025-03-10T00:00:00Z', end_date: '2028-03-10T00:00:00Z',
  rent_amount: 1850, payment_day: 5, next_readjustment: '2027-03-01T00:00:00Z', ...extra,
})
const leases = [
  lease('l1', 't1', 'u302'),
  lease('l2', 't2', 'u3', { end_date: null, rent_amount: 1600, next_readjustment: '2026-10-01T00:00:00Z' }),
  lease('l3', 't3', 'u12', { status: 'ENDED', rent_amount: 1100, next_readjustment: null }),
  lease('l4', 't1', 'u4', { end_date: '2026-11-26T00:00:00Z', rent_amount: 1550, next_readjustment: '2027-01-01T00:00:00Z' }),
]
const tenants = [{ id: 't1', name: 'Marina Souza' }, { id: 't2', name: 'Bruno Lima' }, { id: 't3', name: 'Carla Dias' }]
const properties = [
  { id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u302', label: 'Apartamento 302' }, { id: 'u4', label: 'Kitnet 4' }] },
  { id: 'p2', name: 'Centro Empresarial', units: [{ id: 'u3', label: 'Sala 3' }] },
  { id: 'p3', name: 'Ed. Jasmim', units: [{ id: 'u12', label: 'Ap 12' }] },
]

type Opts = { ls?: unknown; ts?: unknown; ps?: unknown }
function mockApi(o: Opts = {}) {
  const { ls = leases, ts = tenants, ps = properties } = o
  goFetch.mockImplementation(async (path: string) => {
    const v = path === '/api/v1/leases' ? ls : path === '/api/v1/tenants' ? ts : path === '/api/v1/properties' ? ps : undefined
    if (v === undefined) throw new Error('rota inesperada ' + path)
    if (v instanceof Error) throw v
    return v
  })
}
async function renderPage(params: Record<string, string> = {}) {
  return render(await LeasesPage({ searchParams: Promise.resolve(params) }))
}
const rowOf = (text: string) => within(screen.getByRole('table')).getByText(text).closest('tr')!

beforeEach(() => {
  goFetch.mockReset()
  vi.setSystemTime(new Date('2026-11-06T15:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('lista de contratos', () => {
  it('colunas do canvas', async () => {
    mockApi()
    await renderPage()
    const table = screen.getByRole('table')
    for (const h of ['Unidade', 'Inquilino', 'Início', 'Fim', 'Aluguel', 'Próx. reajuste', 'Situação']) {
      expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument()
    }
  })

  it('linha da Marina', async () => {
    mockApi()
    await renderPage()
    const row = rowOf('Apartamento 302')
    for (const t of ['Ed. Aurora', 'Marina Souza', '10/03/2025', '10/03/2028', 'R$ 1.850,00', '03/2027', 'Ativo']) {
      expect(row).toHaveTextContent(t)
    }
  })

  it('contrato aberto: "Sem fim"; reajuste de mês anterior: "pendente"', async () => {
    mockApi()
    await renderPage()
    const row = rowOf('Sala 3')
    expect(row).toHaveTextContent('Sem fim')
    expect(row).toHaveTextContent('pendente')
  })

  it('indicadores', async () => {
    mockApi()
    await renderPage()
    const kpis = screen.getByRole('region', { name: 'Indicadores' })
    expect(kpis).toHaveTextContent('Ativos')
    expect(kpis).toHaveTextContent('R$ 5.000,00 por mês')
    expect(kpis).toHaveTextContent('Vencendo em 30 dias')
    expect(kpis).toHaveTextContent('Reajuste em 90 dias')
    expect(kpis).toHaveTextContent('Encerrados')
  })

  it('busca por inquilino', async () => {
    mockApi()
    await renderPage({ q: 'bruno' })
    const table = screen.getByRole('table')
    expect(within(table).getByText('Bruno Lima')).toBeInTheDocument()
    expect(within(table).queryByText('Marina Souza')).toBeNull()
  })

  it('filtro por situação', async () => {
    mockApi()
    await renderPage({ situacao: 'ENDED' })
    const table = screen.getByRole('table')
    expect(within(table).getByText('Carla Dias')).toBeInTheDocument()
    expect(within(table).queryByText('Bruno Lima')).toBeNull()
  })

  it('nada encontrado', async () => {
    mockApi()
    await renderPage({ q: 'zzz' })
    expect(screen.getByText('Nenhum contrato encontrado.')).toBeInTheDocument()
  })

  it('vazio: convite para o primeiro contrato', async () => {
    mockApi({ ls: [] })
    await renderPage()
    expect(screen.getByText('Crie seu primeiro contrato')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Criar contrato' })[0]).toHaveAttribute('href', '/leases?novo=1')
  })

  it('erro de contratos: mensagem e nova tentativa', async () => {
    mockApi({ ls: new Error('boom') })
    await renderPage()
    expect(screen.getByText('Não foi possível carregar os contratos.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar novamente' })).toHaveAttribute('href', '/leases')
  })

  it('sem inquilinos ou imóveis: "—" e aviso', async () => {
    mockApi({ ts: new Error('x'), ps: new Error('y') })
    await renderPage()
    expect(rowOf('R$ 1.850,00')).toHaveTextContent('—')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('cards no celular', async () => {
    mockApi()
    const { container } = await renderPage()
    expect(container.querySelectorAll('ul > li').length).toBe(4)
  })
})
