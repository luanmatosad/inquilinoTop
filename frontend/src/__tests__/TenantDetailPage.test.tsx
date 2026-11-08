import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('@/app/tenants/actions', () => ({ createTenant: vi.fn(), updateTenant: vi.fn(), deleteTenant: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/tenants/t1',
  useSearchParams: () => new URLSearchParams(),
  notFound,
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import TenantPage from '@/app/tenants/[id]/page'

const marina = {
  id: 't1',
  name: 'Marina Souza',
  email: 'marina@email.com',
  phone: '11988881111',
  document: '52998224725',
  person_type: 'PF',
  notes: 'Prefere receber a cobrança de manhã.',
  postal_code: '69100000',
  address_line: 'Rua Quinze, 120',
  city: 'Itacoatiara',
  state: 'AM',
  is_active: true,
}
const lease = { id: 'l1', tenant_id: 't1', unit_id: 'u302', status: 'ACTIVE', start_date: '2025-03-10', rent_amount: 1850, payment_day: 5 }
const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u302', label: 'Apartamento 302' }] }]
const rent = (status: string, due = '2026-11-05') => ({ lease_id: 'l1', status, type: 'RENT', due_date: due, gross_amount: 1850 })

type Opts = { tenant?: unknown; ls?: unknown; ps?: unknown; mo?: unknown; la?: unknown }
function mockApi(o: Opts = {}) {
  const { tenant = marina, ls = [lease], ps = properties, mo = [rent('PENDING')], la = [] } = o
  goFetch.mockImplementation(async (path: string) => {
    const value =
      path === '/api/v1/tenants/t1' ? tenant
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

async function renderPage(search: Record<string, string> = {}) {
  return render(await TenantPage({ params: Promise.resolve({ id: 't1' }), searchParams: Promise.resolve(search) }))
}

beforeEach(() => {
  goFetch.mockReset()
  notFound.mockClear()
  vi.setSystemTime(new Date('2026-11-07T15:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('cabeçalho', () => {
  it('breadcrumb, nome, contato, situação e ações', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('link', { name: 'Inquilinos' })).toHaveAttribute('href', '/tenants')
    expect(screen.getByRole('heading', { name: 'Marina Souza' })).toBeInTheDocument()
    expect(screen.getByText('marina@email.com · (11) 98888-1111')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/tenants/t1?editar=1')
    const wa = screen.getAllByRole('link', { name: 'Abrir WhatsApp' })
    expect(wa.length).toBeGreaterThanOrEqual(1)
    for (const a of wa) {
      expect(a).toHaveAttribute('href', 'https://wa.me/5511988881111')
      expect(a).toHaveAttribute('target', '_blank')
      expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    }
    expect(screen.getByRole('group', { name: 'Situação de cobrança' })).toHaveTextContent('Previsto')
  })

  it('inquilino inexistente vira 404', async () => {
    mockApi({ tenant: new Error('NOT_FOUND') })
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('sem fiador e sem histórico de contratos', async () => {
    mockApi()
    await renderPage()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByText(/fiador/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Extrato' }).getAttribute('href')).toBe('/tenants/t1/extrato')
    expect(screen.queryByText(/^Contratos \(/)).not.toBeInTheDocument()
  })
})

describe('com contrato', () => {
  it('cartão Cobrança do mês', async () => {
    mockApi()
    await renderPage()
    const card = screen.getByRole('region', { name: 'Cobrança do mês' })
    expect(card).toHaveTextContent('Novembro · R$ 1.850,00')
    expect(card).toHaveTextContent('Vence em 05/11/2026')
    expect(within(card).getByRole('link', { name: 'Ver cobrança' })).toHaveAttribute('href', '/financial/receivables')
  })

  it('cartão Contrato atual', async () => {
    mockApi()
    await renderPage()
    const card = screen.getByRole('region', { name: 'Contrato atual' })
    expect(card).toHaveTextContent('Apartamento 302 · Ed. Aurora')
    expect(card).toHaveTextContent('R$ 1.850,00')
    expect(card).toHaveTextContent('Vence todo dia 5')
    expect(within(card).getByRole('link', { name: 'Ver contrato' })).toHaveAttribute('href', '/leases/l1')
  })

  it('mês sem cobrança gerada', async () => {
    mockApi({ mo: [] })
    await renderPage()
    expect(screen.getByRole('region', { name: 'Cobrança do mês' })).toHaveTextContent('Nenhuma cobrança neste mês.')
  })

  it('não mostra o cartão "Sem contrato"', async () => {
    mockApi()
    await renderPage()
    expect(screen.queryByText('Para gerar cobranças, ligue este inquilino a uma unidade.')).not.toBeInTheDocument()
  })
})

describe('sem contrato', () => {
  it('selo, mensagem e Criar contrato', async () => {
    mockApi({ ls: [], mo: [] })
    await renderPage()
    expect(screen.getByRole('group', { name: 'Situação de cobrança' })).toHaveTextContent('Sem contrato')
    expect(screen.getByText('Para gerar cobranças, ligue este inquilino a uma unidade.')).toBeInTheDocument()
    const create = screen.getAllByRole('link', { name: 'Criar contrato' })
    expect(create.length).toBeGreaterThanOrEqual(1)
    for (const l of create) expect(l).toHaveAttribute('href', '/leases?novo=1&inquilino=t1')
    expect(screen.queryByRole('region', { name: 'Cobrança do mês' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Contrato atual' })).not.toBeInTheDocument()
  })

  it('só contrato encerrado também é "sem contrato"', async () => {
    mockApi({ ls: [{ ...lease, status: 'ENDED' }], mo: [] })
    await renderPage()
    expect(screen.getByText('Para gerar cobranças, ligue este inquilino a uma unidade.')).toBeInTheDocument()
  })
})

describe('observações e contato', () => {
  it('observações aparecem quando existem', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('region', { name: 'Observações' })).toHaveTextContent('Prefere receber a cobrança de manhã.')
  })

  it('sem observações o cartão não existe', async () => {
    mockApi({ tenant: { ...marina, notes: null } })
    await renderPage()
    expect(screen.queryByRole('region', { name: 'Observações' })).not.toBeInTheDocument()
  })

  it('contato com CPF mascarado', async () => {
    mockApi()
    await renderPage()
    const card = screen.getByRole('region', { name: 'Contato' })
    expect(card).toHaveTextContent('marina@email.com')
    expect(card).toHaveTextContent('(11) 98888-1111')
    expect(card).toHaveTextContent('CPF')
    expect(card).toHaveTextContent('529.982.***-25')
  })

  it('empresa mostra CNPJ', async () => {
    mockApi({ tenant: { ...marina, person_type: 'PJ', document: '12345678000190' } })
    await renderPage()
    const card = screen.getByRole('region', { name: 'Contato' })
    expect(card).toHaveTextContent('CNPJ')
    expect(card).toHaveTextContent('12.345.***/0001-90')
  })

  it('sem celular válido não há botão de WhatsApp', async () => {
    mockApi({ tenant: { ...marina, phone: null } })
    await renderPage()
    expect(screen.queryByRole('link', { name: 'Abrir WhatsApp' })).not.toBeInTheDocument()
  })
})

describe('documento completo só na edição', () => {
  it('fora da edição o documento completo não está em lugar nenhum', async () => {
    mockApi()
    await renderPage()
    expect(document.body.innerHTML).not.toContain('52998224725')
    expect(document.body.innerHTML).not.toContain('529.982.247-25')
    expect(screen.queryByDisplayValue('529.982.247-25')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('?editar=1 abre o painel com o documento completo e o endereço fica só no corpo da edição', async () => {
    mockApi()
    await renderPage({ editar: '1' })
    const dialog = screen.getByRole('dialog', { name: 'Editar inquilino' })
    expect(within(dialog).getByLabelText('CPF')).toHaveValue('529.982.247-25')
    expect(within(dialog).queryByLabelText(/CEP|Endereço|Cidade/i)).not.toBeInTheDocument()
  })
})

describe('dados indisponíveis', () => {
  it('contratos fora do ar: aviso e nenhuma afirmação de "sem contrato"', async () => {
    mockApi({ ls: new Error('403') })
    await renderPage()
    expect(screen.getByRole('status')).toHaveTextContent(/contratos indisponíveis/i)
    expect(screen.queryByText('Para gerar cobranças, ligue este inquilino a uma unidade.')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Marina Souza' })).toBeInTheDocument()
  })

  it('pagamentos fora do ar: o cartão de cobrança avisa e o contrato segue', async () => {
    mockApi({ mo: new Error('500') })
    await renderPage()
    expect(screen.getByRole('region', { name: 'Cobrança do mês' })).toHaveTextContent(/cobrança do mês está indisponível/i)
    expect(screen.getByRole('region', { name: 'Contrato atual' })).toHaveTextContent('Apartamento 302')
  })
})
