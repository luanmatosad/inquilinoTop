import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('@/app/tenants/actions', () => ({ createTenant: vi.fn(), updateTenant: vi.fn(), deleteTenant: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/tenants',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import TenantsPage from '@/app/tenants/page'

const t = (id: string, name: string, extra = {}) => ({
  id,
  name,
  email: `${name.split(' ')[0].toLowerCase()}@email.com`,
  phone: '11988881111',
  document: '12345678909',
  person_type: 'PF',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  ...extra,
})
const lease = (id: string, tenant_id: string, unit_id: string, status = 'ACTIVE') => ({
  id,
  tenant_id,
  unit_id,
  status,
  start_date: '2025-03-10',
  rent_amount: 1850,
  payment_day: 5,
})
const pay = (lease_id: string, status: string, type = 'RENT', due_date = '2026-11-05') => ({
  lease_id,
  status,
  type,
  due_date,
  gross_amount: 1850,
})

const tenants = [
  t('t1', 'Marina Souza'),
  t('t2', 'Bruno Lima', { document: '98765432100' }),
  t('t3', 'Carla Dias', { document: '22233344455' }),
  t('t4', 'Paulo Nogueira', { document: '33344455566' }),
  t('t5', 'Luan Matos', { document: '94548368068' }),
]
const leases = [
  lease('l1', 't1', 'u302'),
  lease('l2', 't2', 'u3'),
  lease('l3', 't3', 'u12'),
  lease('l4', 't4', 'u4'),
]
const properties = [
  { id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u302', label: 'Ap 302' }] },
  { id: 'p2', name: 'Centro Empresarial', units: [{ id: 'u3', label: 'Sala 3' }] },
  { id: 'p3', name: 'Ed. Jasmim', units: [{ id: 'u12', label: 'Ap 12' }] },
  { id: 'p4', name: 'Rua Sete', units: [{ id: 'u4', label: 'Kitnet 4' }] },
]
const month = [pay('l1', 'PAID'), pay('l3', 'PAID'), pay('l4', 'PENDING')]
const late = [pay('l2', 'LATE', 'RENT', '2026-10-05')]

type Opts = { ts?: unknown; ls?: unknown; ps?: unknown; mo?: unknown; la?: unknown }
function mockApi(o: Opts = {}) {
  const { ts = tenants, ls = leases, ps = properties, mo = month, la = late } = o
  goFetch.mockImplementation(async (path: string) => {
    const value =
      path === '/api/v1/tenants' ? ts
      : path === '/api/v1/leases' ? ls
      : path === '/api/v1/properties' ? ps
      : path.startsWith('/api/v1/payments?status=LATE') ? la
      : path.startsWith('/api/v1/payments?from=') ? mo
      : undefined
    if (value === undefined) throw new Error('rota inesperada ' + path)
    if (value instanceof Error) throw value
    return value
  })
}

async function renderPage(params: Record<string, string> = {}) {
  return render(await TenantsPage({ searchParams: Promise.resolve(params) }))
}
const rowOf = (name: string) => within(screen.getByRole('table')).getByRole('link', { name }).closest('tr')!

beforeEach(() => {
  goFetch.mockReset()
  vi.setSystemTime(new Date('2026-11-07T15:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('lista de inquilinos', () => {
  it('colunas do canvas', async () => {
    mockApi()
    await renderPage()
    const table = screen.getByRole('table')
    for (const h of ['Inquilino', 'Documento', 'Imóvel e unidade', 'Cobrança do mês']) {
      expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument()
    }
  })

  it('linha de Marina: contato, documento mascarado, unidade e Pago', async () => {
    mockApi()
    await renderPage()
    const row = rowOf('Marina Souza')
    expect(row).toHaveTextContent('marina@email.com · (11) 98888-1111')
    expect(row).toHaveTextContent('123.456.***-09')
    expect(row).toHaveTextContent('Ap 302 · Ed. Aurora')
    expect(row).toHaveTextContent('Pago')
  })

  it('atraso de outro mês aparece como Atrasado', async () => {
    mockApi()
    await renderPage()
    expect(rowOf('Bruno Lima')).toHaveTextContent('Atrasado')
  })

  it('aluguel pendente aparece como Previsto', async () => {
    mockApi()
    await renderPage()
    expect(rowOf('Paulo Nogueira')).toHaveTextContent('Previsto')
  })

  it('sem contrato: "Sem contrato" e "—"', async () => {
    mockApi()
    await renderPage()
    const row = rowOf('Luan Matos')
    expect(row).toHaveTextContent('Sem contrato')
    expect(row).toHaveTextContent('—')
  })

  it('o documento completo não aparece em nenhum lugar da página', async () => {
    mockApi()
    const { container } = await renderPage()
    for (const full of ['12345678909', '123.456.789-09', '98765432100', '987.654.321-00']) {
      expect(container.innerHTML).not.toContain(full)
    }
  })

  it('rodapé com a contagem e plural correto', async () => {
    mockApi()
    await renderPage()
    expect(screen.getAllByText('5 inquilinos').length).toBeGreaterThanOrEqual(1)
  })

  it('singular com um só inquilino', async () => {
    mockApi({ ts: [tenants[0]] })
    await renderPage()
    expect(screen.getAllByText('1 inquilino').length).toBeGreaterThanOrEqual(1)
  })

  it('busca o mês corrente e os atrasados', async () => {
    mockApi()
    await renderPage()
    const paths = goFetch.mock.calls.map((c) => c[0] as string)
    expect(paths).toContain('/api/v1/payments?from=2026-11-01&to=2026-11-30')
    expect(paths).toContain('/api/v1/payments?status=LATE')
  })

  it('botão Importar leva a /import', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('link', { name: 'Importar' })).toHaveAttribute('href', '/import')
  })

  it('botões "Cadastrar inquilino" abrem o painel por ?novo=1', async () => {
    mockApi()
    await renderPage()
    const links = screen.getAllByRole('link', { name: 'Cadastrar inquilino' })
    expect(links.length).toBeGreaterThanOrEqual(1)
    for (const l of links) expect(l).toHaveAttribute('href', '/tenants?novo=1')
  })

  it('celular: cards com unidade e situação', async () => {
    mockApi()
    await renderPage()
    expect(screen.getAllByText('Marina Souza').length).toBeGreaterThanOrEqual(2) // tabela + card
  })
})

describe('busca e filtro', () => {
  it('por nome', async () => {
    mockApi()
    await renderPage({ q: 'marina' })
    const table = screen.getByRole('table')
    expect(within(table).getByRole('link', { name: 'Marina Souza' })).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Bruno Lima' })).not.toBeInTheDocument()
  })

  it('por e-mail', async () => {
    mockApi()
    await renderPage({ q: 'bruno@' })
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'Bruno Lima' })).toBeInTheDocument()
  })

  it('pelos dígitos do CPF (a busca roda no servidor com o documento completo)', async () => {
    mockApi()
    await renderPage({ q: '987.654' })
    const table = screen.getByRole('table')
    expect(within(table).getByRole('link', { name: 'Bruno Lima' })).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Marina Souza' })).not.toBeInTheDocument()
  })

  it('filtro Atrasado', async () => {
    mockApi()
    await renderPage({ cobranca: 'LATE' })
    const table = screen.getByRole('table')
    expect(within(table).getByRole('link', { name: 'Bruno Lima' })).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Marina Souza' })).not.toBeInTheDocument()
  })

  it('filtro Sem contrato', async () => {
    mockApi()
    await renderPage({ cobranca: 'NO_LEASE' })
    const table = screen.getByRole('table')
    expect(within(table).getByRole('link', { name: 'Luan Matos' })).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Bruno Lima' })).not.toBeInTheDocument()
  })

  it('sem resultado: mensagem própria, diferente do estado vazio', async () => {
    mockApi()
    await renderPage({ q: 'zzz' })
    expect(screen.getByText('Nenhum inquilino encontrado.')).toBeInTheDocument()
    expect(screen.queryByText('Cadastre seu primeiro inquilino')).not.toBeInTheDocument()
  })
})

describe('estados', () => {
  it('vazio: convite com a frase do canvas', async () => {
    mockApi({ ts: [] })
    await renderPage()
    expect(screen.getByText('Cadastre seu primeiro inquilino')).toBeInTheDocument()
    expect(screen.getByText('Para começar, só precisa de nome e contato. O contrato vem depois.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('erro de inquilinos: mensagem e "Tentar novamente"', async () => {
    mockApi({ ts: new Error('boom') })
    await renderPage()
    expect(screen.getByText('Não foi possível carregar os inquilinos.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar novamente' })).toHaveAttribute('href', '/tenants')
  })

  it('pagamentos fora do ar: só a cobrança vira "—", com aviso', async () => {
    mockApi({ mo: new Error('500') })
    await renderPage()
    const row = rowOf('Marina Souza')
    expect(row).toHaveTextContent('Ap 302 · Ed. Aurora')
    expect(row).not.toHaveTextContent('Pago')
    expect(screen.getByRole('status')).toHaveTextContent(/cobrança do mês está indisponível/i)
  })

  it('contratos fora do ar: imóvel e cobrança viram "—", sem dizer "Sem contrato"', async () => {
    mockApi({ ls: new Error('403') })
    await renderPage()
    const row = rowOf('Marina Souza')
    expect(row).not.toHaveTextContent('Sem contrato')
    expect(row).not.toHaveTextContent('Ap 302')
    expect(screen.getByRole('status')).toHaveTextContent(/contratos indisponíveis/i)
  })

  it('imóveis fora do ar: unidade vira "—", cobrança continua', async () => {
    mockApi({ ps: new Error('500') })
    await renderPage()
    const row = rowOf('Marina Souza')
    expect(row).not.toHaveTextContent('Ap 302')
    expect(row).toHaveTextContent('Pago')
    expect(screen.getByRole('status')).toHaveTextContent(/imóveis indisponíveis/i)
  })
})

describe('painel de cadastro', () => {
  it('fechado por padrão e aberto com ?novo=1', async () => {
    mockApi()
    const { unmount } = await renderPage()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()
    await renderPage({ novo: '1' })
    expect(screen.getByRole('dialog', { name: 'Novo inquilino' })).toBeInTheDocument()
  })
})
