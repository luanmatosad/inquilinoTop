import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('@/app/properties/actions', () => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  createUnit: vi.fn(),
  updateUnit: vi.fn(),
  deleteUnit: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/properties/p1',
  useSearchParams: () => new URLSearchParams(),
  notFound,
  redirect: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import PropertyPage from '@/app/properties/[id]/page'

const unit = (id: string, label: string, extra = {}) => ({
  id,
  property_id: 'p1',
  label,
  is_active: true,
  ...extra,
})

const property = {
  id: 'p1',
  name: 'Ed. Aurora',
  type: 'RESIDENTIAL',
  address_line: 'Rua Quinze',
  number: '120',
  neighborhood: 'Centro',
  city: 'Itacoatiara',
  state: 'AM',
  postal_code: '69100000',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  units: [
    unit('u302', 'Apartamento 302', { floor: '3º andar', area_m2: 62, bedrooms: 3, bathrooms: 2 }),
    unit('u101', 'Apartamento 101', { floor: 'Térreo', area_m2: 48, bedrooms: 2, bathrooms: 1 }),
    unit('u201', 'Apartamento 201', { floor: '1º andar', area_m2: 48, bedrooms: 2, bathrooms: 1 }),
  ],
}
const leases = [{ unit_id: 'u302', tenant_id: 't1', status: 'ACTIVE', start_date: '2025-03-10' }]
const tenants = [{ id: 't1', name: 'Marina Souza' }]

function mockApi(opts: { prop?: unknown; ls?: unknown; ts?: unknown } = {}) {
  const { prop = property, ls = leases, ts = tenants } = opts
  goFetch.mockImplementation(async (path: string) => {
    const value = path.startsWith('/api/v1/properties/') ? prop : path === '/api/v1/leases' ? ls : ts
    if (value instanceof Error) throw value
    return value
  })
}

async function renderPage(search: Record<string, string> = {}) {
  render(await PropertyPage({ params: Promise.resolve({ id: 'p1' }), searchParams: Promise.resolve(search) }))
}

beforeEach(() => {
  goFetch.mockReset()
  notFound.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('cabeçalho do detalhe', () => {
  it('breadcrumb, nome, endereço, tipo e número de unidades', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('link', { name: 'Imóveis' })).toHaveAttribute('href', '/properties')
    expect(screen.getByRole('heading', { name: 'Ed. Aurora' })).toBeInTheDocument()
    const subtitle = screen.getByText(/Rua Quinze, 120 · Centro, Itacoatiara\/AM/)
    expect(subtitle).toHaveTextContent('Residencial')
    expect(subtitle).toHaveTextContent('3 unidades')
  })

  it('imóvel inexistente vira 404', async () => {
    mockApi({ prop: new Error('NOT_FOUND') })
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
})

describe('abas', () => {
  it('Unidades é a aba padrão', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('tab', { name: 'Unidades' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Informações' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Informações' })).toHaveAttribute('href', '/properties/p1?aba=informacoes')
    expect(screen.queryByRole('tab', { name: 'Despesas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Recebimento' })).not.toBeInTheDocument()
  })

  it('?aba=informacoes mostra o formulário de edição com os valores atuais', async () => {
    mockApi()
    await renderPage({ aba: 'informacoes' })
    expect(screen.getByRole('tab', { name: 'Informações' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Nome do imóvel')).toHaveValue('Ed. Aurora')
    expect(screen.getByLabelText('Número')).toHaveValue('120')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('aba Unidades', () => {
  it('colunas do canvas', async () => {
    mockApi()
    await renderPage()
    const table = screen.getByRole('table')
    for (const h of ['Unidade', 'Andar', 'Área', 'Quartos', 'Banheiros', 'Situação', 'Inquilino']) {
      expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument()
    }
  })

  it('ordena as unidades pelo nome, com números em ordem natural', async () => {
    mockApi()
    await renderPage()
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      'Apartamento 101',
      'Apartamento 201',
      'Apartamento 302',
    ])
  })

  it('unidade alugada mostra situação, inquilino e "desde"', async () => {
    mockApi()
    await renderPage()
    const row = within(screen.getByRole('table')).getByText('Apartamento 302').closest('tr')!
    expect(row).toHaveTextContent('3º andar')
    expect(row).toHaveTextContent('62 m²')
    expect(row).toHaveTextContent('Alugada')
    expect(row).toHaveTextContent('Marina Souza')
    expect(row).toHaveTextContent('desde 03/2025')
  })

  it('unidade vaga mostra "Vaga" e "—" no inquilino', async () => {
    mockApi()
    await renderPage()
    const row = within(screen.getByRole('table')).getByText('Apartamento 101').closest('tr')!
    expect(row).toHaveTextContent('Vaga')
    expect(row).toHaveTextContent('—')
  })

  it('contratos fora do ar: situação "—" e aviso discreto', async () => {
    mockApi({ ls: new Error('403') })
    await renderPage()
    const row = within(screen.getByRole('table')).getByText('Apartamento 302').closest('tr')!
    expect(row).not.toHaveTextContent('Alugada')
    expect(screen.getByRole('status')).toHaveTextContent(/ocupação está indisponível/i)
  })

  it('rodapé da tabela no singular quando há uma unidade', async () => {
    mockApi({ prop: { ...property, units: [property.units[0]] } })
    await renderPage()
    expect(screen.getByText('1 unidade')).toBeInTheDocument() // rodapé da tabela
  })

  it('imóvel sem unidades: mensagem', async () => {
    mockApi({ prop: { ...property, units: [] } })
    await renderPage()
    expect(screen.getByText('Nenhuma unidade cadastrada.')).toBeInTheDocument()
  })

  it('"Adicionar unidade" abre o painel por ?unidade=nova', async () => {
    mockApi()
    await renderPage()
    const links = screen.getAllByRole('link', { name: 'Adicionar unidade' })
    for (const l of links) expect(l).toHaveAttribute('href', '/properties/p1?unidade=nova')
  })
})

describe('painel de unidade', () => {
  it('fechado por padrão', async () => {
    mockApi()
    await renderPage()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('?unidade=nova abre "Adicionar unidade" com os campos do canvas', async () => {
    mockApi()
    await renderPage({ unidade: 'nova' })
    const dialog = screen.getByRole('dialog', { name: 'Adicionar unidade' })
    expect(dialog).toHaveTextContent('Ed. Aurora')
    expect(dialog).toHaveTextContent('O endereço é o do imóvel, então não precisa preencher de novo.')
    for (const l of ['Nome da unidade', 'Andar (opcional)', 'Área (m²)', 'Quartos', 'Banheiros', 'Observações']) {
      expect(within(dialog).getByLabelText(l)).toBeInTheDocument()
    }
    expect(within(dialog).getByLabelText(/aluguel de referência/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cadastrar unidade' })).toBeInTheDocument()
  })

  it('?unidade=<id> abre "Editar unidade" com os valores da unidade', async () => {
    mockApi()
    await renderPage({ unidade: 'u302' })
    const dialog = screen.getByRole('dialog', { name: 'Editar unidade' })
    expect(within(dialog).getByLabelText('Nome da unidade')).toHaveValue('Apartamento 302')
    expect(within(dialog).getByLabelText('Área (m²)')).toHaveValue('62')
    expect(within(dialog).getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument()
  })

  it('?unidade=<id desconhecido> não abre nada', async () => {
    mockApi()
    await renderPage({ unidade: 'nao-existe' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
