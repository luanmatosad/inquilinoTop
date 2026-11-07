import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('@/app/properties/actions', () => ({ createProperty: vi.fn(), updateProperty: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/properties',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import PropertiesPage from '@/app/properties/page'

const prop = (id: string, name: string, type: string, units: string[], extra = {}) => ({
  id,
  name,
  type,
  address_line: 'Rua Quinze',
  number: '120',
  neighborhood: 'Centro',
  city: 'Itacoatiara',
  state: 'AM',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  units: units.map((u) => ({ id: u })),
  ...extra,
})
const lease = (unit_id: string, status = 'ACTIVE') => ({
  unit_id,
  tenant_id: 't-' + unit_id,
  status,
  start_date: '2025-03-10',
})

const properties = [
  prop('p1', 'Ed. Aurora', 'RESIDENTIAL', ['a1', 'a2', 'a3']),
  prop('p2', 'Ed. Jasmim', 'RESIDENTIAL', ['j1', 'j2'], { address_line: 'Av. Brasil', number: '845' }),
  prop('p3', 'Casa · Rua das Flores', 'SINGLE', ['c1']),
  prop('p4', 'Centro Empresarial', 'COMMERCIAL', ['e1', 'e2', 'e3', 'e4']),
]
const leases = [lease('a3'), lease('j1'), lease('c1'), lease('e1'), lease('e2', 'ENDED')]

function mockApi({ props = properties as unknown[], ls = leases as unknown[] | Error } = {}) {
  goFetch.mockImplementation(async (path: string) => {
    if (path === '/api/v1/properties') {
      if (props instanceof Error) throw props
      return props
    }
    if (path === '/api/v1/leases') {
      if (ls instanceof Error) throw ls
      return ls
    }
    throw new Error('rota inesperada ' + path)
  })
}

async function renderPage(params: Record<string, string> = {}) {
  render(await PropertiesPage({ searchParams: Promise.resolve(params) }))
}

beforeEach(() => {
  goFetch.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('lista de imóveis', () => {
  it('mostra a tabela com as colunas do canvas', async () => {
    mockApi()
    await renderPage()
    const table = screen.getByRole('table')
    for (const h of ['Imóvel', 'Tipo', 'Unidades', 'Ocupação']) {
      expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument()
    }
  })

  it('linha de Ed. Aurora: endereço composto, tipo, unidades e ocupação', async () => {
    mockApi()
    await renderPage()
    const row = within(screen.getByRole('table')).getByRole('link', { name: 'Ed. Aurora' }).closest('tr')!
    expect(row).toHaveTextContent('Rua Quinze, 120 · Centro, Itacoatiara/AM')
    expect(row).toHaveTextContent('Residencial')
    expect(row).toHaveTextContent('3')
    expect(row).toHaveTextContent('1 de 3 alugadas')
  })

  it('imóvel SINGLE aparece como Casa e "Alugada"', async () => {
    mockApi()
    await renderPage()
    const row = within(screen.getByRole('table')).getByRole('link', { name: /Rua das Flores/ }).closest('tr')!
    expect(row).toHaveTextContent('Casa')
    expect(row).toHaveTextContent('Alugada')
  })

  it('contrato encerrado não conta como alugada', async () => {
    mockApi()
    await renderPage()
    const row = within(screen.getByRole('table')).getByRole('link', { name: 'Centro Empresarial' }).closest('tr')!
    expect(row).toHaveTextContent('1 de 4 alugadas')
  })

  it('indicadores: imóveis, unidades, alugadas e vagas', async () => {
    mockApi()
    await renderPage()
    const kpis = screen.getByRole('region', { name: 'Indicadores' })
    expect(within(kpis).getByText('Imóveis').parentElement).toHaveTextContent('4')
    expect(within(kpis).getByText('Unidades').parentElement).toHaveTextContent('10')
    expect(within(kpis).getByText('Alugadas').parentElement).toHaveTextContent('4')
    expect(within(kpis).getByText('Alugadas').parentElement).toHaveTextContent('de 10')
    expect(within(kpis).getByText('Vagas').parentElement).toHaveTextContent('6')
  })

  it('celular: linha-resumo no lugar dos indicadores', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByText('4 imóveis · 10 unidades · 4 alugadas')).toBeInTheDocument()
  })

  it('singular quando há um só imóvel e uma só unidade', async () => {
    mockApi({ props: [prop('p1', 'Casa', 'SINGLE', ['c1'])], ls: [] })
    await renderPage()
    expect(screen.getByText('1 imóvel · 1 unidade · 0 alugadas')).toBeInTheDocument()
    expect(screen.getByText('1 imóvel · 1 unidade')).toBeInTheDocument() // rodapé da tabela
  })

  it('celular sem contratos: resumo só com imóveis e unidades', async () => {
    mockApi({ ls: new Error('403') })
    await renderPage()
    expect(screen.getAllByText('4 imóveis · 10 unidades')).toHaveLength(2) // resumo + rodapé da tabela
    expect(screen.queryByText(/ · \d+ alugadas?$/)).not.toBeInTheDocument()
  })

  it('os botões "Cadastrar imóvel" (desktop e celular) abrem o painel por ?novo=1', async () => {
    mockApi()
    await renderPage()
    const links = screen.getAllByRole('link', { name: 'Cadastrar imóvel' })
    expect(links.length).toBeGreaterThanOrEqual(1)
    for (const l of links) expect(l).toHaveAttribute('href', '/properties?novo=1')
  })
})

describe('busca e filtro', () => {
  it('busca por nome, endereço ou cidade', async () => {
    mockApi()
    await renderPage({ q: 'jasmim' })
    const table = screen.getByRole('table')
    expect(within(table).getByRole('link', { name: 'Ed. Jasmim' })).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Ed. Aurora' })).not.toBeInTheDocument()
  })

  it('filtra por tipo', async () => {
    mockApi()
    await renderPage({ tipo: 'COMMERCIAL' })
    const table = screen.getByRole('table')
    expect(within(table).getByRole('link', { name: 'Centro Empresarial' })).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Ed. Aurora' })).not.toBeInTheDocument()
  })

  it('sem resultado para o filtro: mensagem própria, diferente do estado vazio', async () => {
    mockApi()
    await renderPage({ q: 'zzz' })
    expect(screen.getByText('Nenhum imóvel encontrado.')).toBeInTheDocument()
    expect(screen.queryByText('Cadastre seu primeiro imóvel')).not.toBeInTheDocument()
  })
})

describe('estados', () => {
  it('vazio: convite para cadastrar e sem indicadores', async () => {
    mockApi({ props: [] })
    await renderPage()
    expect(screen.getByText('Cadastre seu primeiro imóvel')).toBeInTheDocument()
    expect(screen.getByText(/Leva cerca de 1 minuto/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Indicadores' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('erro ao carregar imóveis: mensagem e "Tentar novamente"', async () => {
    mockApi({ props: new Error('boom') as unknown as unknown[] })
    await renderPage()
    expect(screen.getByText('Não foi possível carregar os imóveis.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar novamente' })).toHaveAttribute('href', '/properties')
  })

  it('contratos fora do ar: lista aparece com "—", sem Alugadas/Vagas e com aviso', async () => {
    mockApi({ ls: new Error('403') })
    await renderPage()
    const table = screen.getByRole('table')
    const row = within(table).getByRole('link', { name: 'Ed. Aurora' }).closest('tr')!
    expect(row).toHaveTextContent('—')
    const kpis = screen.getByRole('region', { name: 'Indicadores' })
    expect(within(kpis).getByText('Imóveis')).toBeInTheDocument()
    expect(within(kpis).queryByText('Alugadas')).not.toBeInTheDocument()
    expect(within(kpis).queryByText('Vagas')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/ocupação está indisponível/i)
  })
})

describe('painel de cadastro', () => {
  it('fica fechado por padrão', async () => {
    mockApi()
    await renderPage()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre com ?novo=1', async () => {
    mockApi()
    await renderPage({ novo: '1' })
    expect(screen.getByRole('dialog', { name: 'Novo imóvel' })).toBeInTheDocument()
  })
})
