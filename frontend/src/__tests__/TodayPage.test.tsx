import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
const getProfile = vi.hoisted(() => vi.fn())
vi.mock('@/app/settings/profile/actions', () => ({ getProfile }))
vi.mock('@/app/financial/actions', () => ({ confirmReport: vi.fn(), rejectReport: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const redirect = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_REDIRECT') }))
vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

import TodayPage from '@/app/page'

const pay = (id: string, lease_id: string, status: string, due: string, extra = {}) => ({
  id, lease_id, status, gross_amount: 1000, due_date: `${due}T00:00:00Z`, type: 'RENT', ...extra,
})
const month = [
  pay('p1', 'l1', 'PENDING', '2026-11-05', { gross_amount: 1850, awaiting_confirmation: true, reported_amount: 1850, reported_at: '2026-11-07T12:12:00Z', has_proof: true }),
  pay('p4', 'l4', 'PAID', '2026-11-02', { gross_amount: 2200 }),
  pay('p5', 'l5', 'PENDING', '2026-11-10', { gross_amount: 1100 }),
]
const late = [pay('p3', 'l3', 'LATE', '2026-10-25', { gross_amount: 1550, late_fee_amount: 31, interest_amount: 10 })]
const leases = [
  { id: 'l1', tenant_id: 't1', unit_id: 'u1', status: 'ACTIVE', start_date: '2025-01-01T00:00:00Z', rent_amount: 1850, next_readjustment: '2026-11-15T00:00:00Z', adjustment_index: 'IGPM' },
  { id: 'l3', tenant_id: 't3', unit_id: 'u3', status: 'ACTIVE', start_date: '2025-01-01T00:00:00Z', rent_amount: 1550, end_date: '2026-11-30T00:00:00Z' },
  { id: 'l4', tenant_id: 't4', unit_id: 'u4', status: 'ACTIVE', start_date: '2025-01-01T00:00:00Z', rent_amount: 2200 },
  { id: 'l5', tenant_id: 't5', unit_id: 'u5', status: 'ACTIVE', start_date: '2025-01-01T00:00:00Z', rent_amount: 1100 },
]
const tenants = [['1', 'Marina Souza'], ['3', 'Bruno Lima'], ['4', 'Carla Dias'], ['5', 'Paulo Nogueira']].map(([n, name]) => ({ id: `t${n}`, name }))
const properties = [
  { id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Ap 302' }] },
  { id: 'p3', name: 'Centro Empresarial', units: [{ id: 'u3', label: 'Sala 3' }] },
  { id: 'p4', name: 'Ed. Jasmim', units: [{ id: 'u4', label: 'Ap 12' }] },
  { id: 'p5', name: 'Rua Sete', units: [{ id: 'u5', label: 'Kitnet 4' }] },
]

type Opts = { mo?: unknown; la?: unknown; ls?: unknown; ts?: unknown; ps?: unknown; cfg?: unknown }
function mockApi(o: Opts = {}) {
  const { mo = month, la = late, ls = leases, ts = tenants, ps = properties, cfg = { pix_key: '11999998888' } } = o
  goFetch.mockImplementation(async (path: string) => {
    const v =
      path.startsWith('/api/v1/payments?status=LATE') ? la
      : path.startsWith('/api/v1/payments?from=') ? mo
      : path === '/api/v1/leases' ? ls
      : path === '/api/v1/tenants' ? ts
      : path === '/api/v1/properties' ? ps
      : path === '/api/v1/payments/config' ? cfg
      : undefined
    if (v === undefined) throw new Error('rota inesperada ' + path)
    if (v instanceof Error) throw v
    return v
  })
}
async function renderPage() {
  return render(await TodayPage())
}
const region = (name: string) => screen.getByRole('region', { name })

beforeEach(() => {
  goFetch.mockReset()
  redirect.mockClear()
  getProfile.mockReset().mockResolvedValue({ full_name: 'Luan Matos de Abreu' })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-07T15:00:00Z')) // sábado, 12:00 em São Paulo
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Hoje', () => {
  it('saudação, data e quantas coisas resolver', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Boa tarde, Luan')
    expect(screen.getByText('Sábado, 7 de novembro')).toBeInTheDocument()
    // 1 aviso + 1 atrasada + 1 a cobrar + reajuste + término = 5
    expect(screen.getByText('Você tem 5 coisas para resolver hoje.')).toBeInTheDocument()
  })

  it('indicadores batem com Recebimentos', async () => {
    mockApi()
    await renderPage()
    const k = region('Indicadores')
    expect(within(k).getByText('Previsto em novembro')).toBeInTheDocument()
    expect(within(k).getByText('R$ 6.700,00')).toBeInTheDocument()
    expect(within(k).getByText('Recebido')).toBeInTheDocument()
    expect(within(k).getByText('R$ 2.200,00')).toBeInTheDocument()
    expect(within(k).getByText('Em atraso')).toBeInTheDocument()
    expect(within(k).getByText('R$ 1.550,00')).toBeInTheDocument()
    expect(within(k).getByText(/a mais antiga há 13 dias/)).toBeInTheDocument()
    expect(within(k).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33')
  })

  it('Confirmar pagamento: aviso, quando avisou e Confirmar abre o diálogo', async () => {
    mockApi()
    await renderPage()
    const s = region('Confirmar pagamento')
    expect(within(s).getByText('Marina Souza')).toBeInTheDocument()
    expect(within(s).getByText('Ap 302 · Ed. Aurora')).toBeInTheDocument()
    expect(within(s).getByText('Informado pelo inquilino')).toBeInTheDocument()
    expect(within(s).getByText('Avisou hoje, 09:12')).toBeInTheDocument()
    await userEvent.click(within(s).getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('dialog', { name: 'Confirmar pagamento de Marina?' })).toBeInTheDocument()
  })

  it('Atrasados: dias de atraso, vencimento e link de cobrar', async () => {
    mockApi()
    await renderPage()
    const s = region('Atrasados')
    expect(within(s).getByText('Bruno Lima')).toBeInTheDocument()
    expect(within(s).getByText('13 dias de atraso')).toBeInTheDocument()
    expect(within(s).getByText('Venceu em 25/10')).toBeInTheDocument()
    expect(within(s).getByRole('link', { name: 'Cobrar' })).toHaveAttribute('href', '/financial/receivables/p3?enviar=1')
  })

  it('Para cobrar: vence em N dias e link de enviar cobrança', async () => {
    mockApi()
    await renderPage()
    const s = region('Para cobrar')
    expect(within(s).getByText('Paulo Nogueira')).toBeInTheDocument()
    expect(within(s).getByText('Vence em 3 dias')).toBeInTheDocument()
    expect(within(s).getByRole('link', { name: 'Enviar cobrança' })).toHaveAttribute('href', '/financial/receivables/p5?enviar=1')
  })

  it('Fique de olho: reajuste sem percentual e contrato terminando', async () => {
    mockApi()
    await renderPage()
    const s = region('Fique de olho')
    expect(within(s).getByText('Reajuste do Ap 302 · Ed. Aurora chega em 15/11')).toBeInTheDocument()
    expect(within(s).getByText(/IGP-M/)).toBeInTheDocument()
    expect(within(s).getByRole('link', { name: 'Revisar reajuste' })).toHaveAttribute('href', '/leases/l1?reajustar=1')
    expect(within(s).getByText('Contrato do Sala 3 · Centro Empresarial termina em 23 dias')).toBeInTheDocument()
    expect(within(s).getByRole('link', { name: 'Ver contrato' })).toHaveAttribute('href', '/leases/l3')
  })

  it('dia vazio: nada para resolver e estado vazio do Confirmar', async () => {
    mockApi({ mo: [pay('p4', 'l4', 'PAID', '2026-11-02', { gross_amount: 2200 })], la: [], ls: [leases[2]] })
    await renderPage()
    expect(screen.getByText('Nada para resolver hoje.')).toBeInTheDocument()
    expect(within(region('Confirmar pagamento')).getByText(/Nada para confirmar/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Atrasados' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Para cobrar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Fique de olho' })).not.toBeInTheDocument()
  })

  it('cobranças indisponíveis: mensagem e tentar de novo', async () => {
    mockApi({ mo: new Error('boom') })
    await renderPage()
    expect(screen.getByText(/Não foi possível carregar/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar novamente' })).toHaveAttribute('href', '/')
  })

  it('sessão expirada manda para o login', async () => {
    mockApi({ mo: new Error('UNAUTHORIZED') })
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('/login'))
  })

  it('inquilinos indisponíveis: segue com "—" e avisa', async () => {
    mockApi({ ts: new Error('boom') })
    await renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('inquilinos')
    expect(within(region('Atrasados')).getByText('—')).toBeInTheDocument()
  })

  it('sem perfil: saudação sem nome', async () => {
    getProfile.mockResolvedValue(null)
    mockApi()
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Boa tarde$/)
  })
})

describe('Hoje · conta nova', () => {
  const fresh = { mo: [], la: [], ls: [], ts: [], ps: [], cfg: {} }

  it('primeiros passos no lugar das listas, KPIs zerados e importar planilha', async () => {
    mockApi(fresh)
    await renderPage()
    const s = region('Primeiros passos')
    expect(within(s).getByText('1 de 5')).toBeInTheDocument()
    expect(within(s).getByRole('link', { name: 'Cadastrar imóvel' })).toHaveAttribute('href', '/properties?novo=1')
    expect(within(s).getByText('Precisa de imóvel e inquilino.')).toBeInTheDocument()
    expect(within(s).queryByRole('link', { name: 'Criar contrato' })).not.toBeInTheDocument()
    expect(within(region('Indicadores')).getAllByText('R$ 0,00').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Importar planilha' })).toHaveAttribute('href', '/import')
    expect(screen.queryByRole('region', { name: 'Atrasados' })).not.toBeInTheDocument()
  })

  it('progresso: imóvel, inquilino e Pix feitos', async () => {
    mockApi({ ...fresh, ts: tenants, ps: properties, cfg: { pix_key: 'a@b.com' } })
    await renderPage()
    const s = region('Primeiros passos')
    expect(within(s).getByText('4 de 5')).toBeInTheDocument()
    expect(within(s).getByRole('link', { name: 'Criar contrato' })).toHaveAttribute('href', '/leases?novo=1')
  })

  it('contratos indisponíveis não mostram a conta nova', async () => {
    mockApi({ ls: new Error('boom') })
    await renderPage()
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument()
  })
})
