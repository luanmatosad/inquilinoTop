import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('@/app/leases/actions', () => ({ updateLease: vi.fn(), createLease: vi.fn(), endLease: vi.fn(), readjustLease: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/leases/l1',
  useSearchParams: () => new URLSearchParams(),
  notFound,
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import LeasePage from '@/app/leases/[id]/page'

const lease = {
  id: 'l1', unit_id: 'u302', tenant_id: 't1', status: 'ACTIVE', start_date: '2025-03-10T00:00:00Z',
  end_date: '2028-03-10T00:00:00Z', rent_amount: 1850, payment_day: 5, adjustment_index: 'IGP-M', adjustment_month: 3,
  next_readjustment: '2027-03-01T00:00:00Z', late_fee_percent: 2, daily_interest_percent: 0.033333, iptu_reimbursable: false,
}
const tenants = [{ id: 't1', name: 'Marina Souza', email: 'marina@email.com', phone: '11988881111', document: '12345678909' }]
const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u302', label: 'Apartamento 302' }] }]
const payments = Array.from({ length: 20 }, (_, i) => ({
  id: `p${i}`, type: 'RENT', status: 'PAID', gross_amount: 1850,
  due_date: new Date(Date.UTC(2025, 2 + i, 5)).toISOString(),
}))
const readjustments = [
  { id: 'r1', applied_at: '2026-03-01T00:00:00Z', old_amount: 1760, new_amount: 1850, percentage: 0.051, index_name: 'IGP-M' },
]

type Opts = { l?: unknown; p?: unknown; r?: unknown; t?: unknown; pr?: unknown }
function mockApi(o: Opts = {}) {
  const { l = lease, p = payments, r = readjustments, t = tenants, pr = properties } = o
  goFetch.mockImplementation(async (path: string) => {
    const v =
      path === '/api/v1/leases/l1' ? l
      : path.endsWith('/payments') ? p
      : path.endsWith('/readjustments') ? r
      : path === '/api/v1/tenants' ? t
      : path === '/api/v1/properties' ? pr
      : path.startsWith('/api/v1/documents') ? []
      : undefined
    if (v === undefined) throw new Error('rota inesperada ' + path)
    if (v instanceof Error) throw v
    return v
  })
}
async function renderPage(search: Record<string, string> = {}) {
  return render(await LeasePage({ params: Promise.resolve({ id: 'l1' }), searchParams: Promise.resolve(search) }))
}

beforeEach(() => {
  goFetch.mockReset()
  notFound.mockClear()
  vi.setSystemTime(new Date('2026-11-06T15:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('detalhe do contrato', () => {
  it('cabeçalho, sem abas', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Apartamento 302 · Ed. Aurora')
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText(/desde 10\/03\/2025/)).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByText(/aditivo/i)).not.toBeInTheDocument()
    for (const n of ['Editar', 'Aplicar reajuste', 'Encerrar contrato']) {
      expect(screen.getByRole('link', { name: n })).toBeInTheDocument()
    }
  })

  it('4 cobranças mais recentes de N', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByText(/Mostrando as 4 mais recentes de 20\./)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Cobranças' }).querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('histórico com a linha Início', async () => {
    mockApi()
    await renderPage()
    const h = screen.getByRole('region', { name: 'Histórico de reajustes' })
    expect(h).toHaveTextContent('03/2026 · IGP-M · 5,1% · R$ 1.850,00')
    expect(h).toHaveTextContent('03/2025 · Início · — · R$ 1.760,00')
  })

  it('termos, incluindo juros ao mês', async () => {
    mockApi()
    await renderPage()
    const t = screen.getByRole('region', { name: 'Termos' })
    for (const x of ['todo dia 5', '10/03/2025 a 10/03/2028', '03/2027 · IGP-M', '2% + 1% ao mês', 'não reembolsável']) {
      expect(t).toHaveTextContent(x)
    }
  })

  it('encerrado: sem botões de ação, com data e motivo', async () => {
    mockApi({ l: { ...lease, status: 'ENDED', end_date: '2026-11-30T00:00:00Z', end_reason: 'TENANT_REQUEST' } })
    await renderPage()
    expect(screen.getByText('Encerrado')).toBeInTheDocument()
    expect(screen.getByText(/Saída em 30\/11\/2026 · Pedido do inquilino/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Encerrar contrato' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Aplicar reajuste' })).not.toBeInTheDocument()
  })

  it('inexistente: página de não encontrado', async () => {
    mockApi({ l: new Error('404') })
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('cobranças e reajustes fora do ar degradam por seção', async () => {
    mockApi({ p: new Error('x'), r: new Error('y') })
    await renderPage()
    expect(screen.getByText('Não foi possível carregar as cobranças.')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível carregar os reajustes.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Termos' })).toBeInTheDocument()
  })

  it('?encerrar=1 abre o modal', async () => {
    mockApi()
    await renderPage({ encerrar: '1' })
    expect(screen.getByRole('dialog', { name: 'Encerrar contrato' })).toBeInTheDocument()
  })
})
