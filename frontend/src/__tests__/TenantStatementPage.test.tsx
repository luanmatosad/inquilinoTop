import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
)
vi.mock('next/navigation', () => ({ notFound, usePathname: () => '/', useRouter: () => ({}) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import StatementPage from '@/app/tenants/[id]/extrato/page'

const lease = { id: 'l1', tenant_id: 't1', unit_id: 'u1', status: 'ACTIVE', start_date: '2025-03-10', rent_amount: 1850, payment_day: 5, next_readjustment: '2027-03-01T00:00:00Z' }
const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Apartamento 302' }] }]
const pay = (id: string, due: string, o: Record<string, unknown> = {}) => ({
  id, lease_id: 'l1', type: 'RENT', status: 'PAID', due_date: due, paid_date: due + 'T00:00:00Z', gross_amount: 1850, net_amount: 1850, ...o,
})

type Opts = { tenant?: unknown; ls?: unknown; pays?: unknown; readj?: unknown }
function mockApi(o: Opts = {}) {
  const { tenant = { id: 't1', name: 'Marina Souza' }, ls = [lease], pays = [], readj = [] } = o
  goFetch.mockImplementation(async (path: string) => {
    const value =
      path === '/api/v1/tenants/t1' ? tenant
      : path === '/api/v1/leases' ? ls
      : path === '/api/v1/properties' ? properties
      : path.startsWith('/api/v1/payments?lease_id=l1') ? pays
      : path === '/api/v1/leases/l1/readjustments' ? readj
      : undefined
    if (value === undefined) throw new Error('rota inesperada ' + path)
    if (value instanceof Error) throw value
    return value
  })
}
async function renderPage(search: Record<string, string> = {}) {
  return render(await StatementPage({ params: Promise.resolve({ id: 't1' }), searchParams: Promise.resolve(search) }))
}

beforeEach(() => {
  goFetch.mockReset()
  vi.setSystemTime(new Date('2026-11-07T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Extrato do inquilino', () => {
  it('em dia: pontualidade e atrasos zerados, sem Cobrar', async () => {
    mockApi({ pays: [pay('a', '2026-09-05'), pay('b', '2026-10-05')] })
    await renderPage()
    expect(screen.getByText('2 de 2')).toBeTruthy()
    expect(screen.getByText('Atrasos')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Cobrar' })).toBeNull()
    expect(screen.getByText('Mostrando 2 dos 2 meses')).toBeTruthy()
    expect(screen.getByText('Nenhum acordo registrado')).toBeTruthy()
  })

  it('com atraso: Em atraso agora e Cobrar na cobrança aberta', async () => {
    mockApi({ pays: [pay('a', '2026-10-30', { status: 'LATE', paid_date: null, net_amount: null, late_fee_amount: 37, interest_amount: 3 })] })
    await renderPage()
    expect(screen.getByText('Em atraso agora')).toBeTruthy()
    expect(screen.getByText(/8 dias · Outubro/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Cobrar' }).getAttribute('href')).toBe('/financial/receivables/a?enviar=1')
  })

  it('sem contrato', async () => {
    mockApi({ ls: [] })
    await renderPage()
    expect(screen.getAllByText('Sem contrato').length).toBeGreaterThan(0)
    expect(screen.queryByText('Recebido')).toBeNull()
  })

  it('período: usa from/to na busca e ver todos', async () => {
    const many = Array.from({ length: 8 }, (_, i) => pay('p' + i, `2026-0${i + 1}-05`))
    mockApi({ pays: many })
    await renderPage({ periodo: '2026' })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/payments?lease_id=l1&from=2026-01-01&to=2026-12-31', {})
    expect(screen.getByText('Mostrando 6 dos 8 meses')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver todos' }).getAttribute('href')).toContain('todos=1')
  })

  it('reajuste e acordo aparecem', async () => {
    mockApi({
      pays: [pay('a', '2026-09-20', { original_due_date: '2026-09-05T00:00:00Z' })],
      readj: [{ applied_at: '2026-03-01T00:00:00Z', old_amount: 1750, new_amount: 1850 }],
    })
    await renderPage()
    expect(screen.getByText(/vencimento de 05\/09 para 20\/09/)).toBeTruthy()
    expect(screen.getByText(/03\/2026, R\$/)).toBeTruthy()
  })

  it('pagamentos fora do ar: aviso, sem derrubar', async () => {
    mockApi({ pays: new Error('boom') })
    await renderPage()
    expect(screen.getByText(/pagamentos está indisponível/)).toBeTruthy()
  })

  it('inquilino inexistente: notFound', async () => {
    mockApi({ tenant: new Error('404') })
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
