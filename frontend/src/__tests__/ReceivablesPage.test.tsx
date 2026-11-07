import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
const payReceivable = vi.hoisted(() => vi.fn())
vi.mock('@/app/financial/actions', () => ({ payReceivable }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh, back: vi.fn() }),
  usePathname: () => '/financial/receivables',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import ReceivablesPage from '@/app/financial/receivables/page'

const pay = (id: string, lease_id: string, status: string, gross_amount: number, due_date: string, extra = {}) => ({
  id, lease_id, status, gross_amount, due_date: `${due_date}T00:00:00Z`, type: 'RENT', ...extra,
})
const month = [
  pay('p1', 'l1', 'PENDING', 1850, '2026-11-05'),
  pay('p2', 'l2', 'PENDING', 1600, '2026-11-05'),
  pay('p4', 'l4', 'PAID', 2200, '2026-11-02'),
  pay('p5', 'l5', 'PENDING', 1100, '2026-11-10'),
  pay('px', 'l1', 'PENDING', 90, '2026-11-05', { type: 'EXPENSE' }),
]
const late = [pay('p3', 'l3', 'LATE', 1550, '2026-10-25', { late_fee_amount: 31, interest_amount: 10.33 })]
const leases = ['1', '2', '3', '4', '5'].map((n) => ({ id: `l${n}`, tenant_id: `t${n}`, unit_id: `u${n}` }))
const tenants = [['1', 'Marina Souza'], ['2', 'Rafael Tavares'], ['3', 'Bruno Lima'], ['4', 'Carla Dias'], ['5', 'Paulo Nogueira']].map(([n, name]) => ({ id: `t${n}`, name }))
const properties = [
  { id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Ap 302' }] },
  { id: 'p2', name: 'Rua das Flores', units: [{ id: 'u2', label: 'Casa' }] },
  { id: 'p3', name: 'Centro Empresarial', units: [{ id: 'u3', label: 'Sala 3' }] },
  { id: 'p4', name: 'Ed. Jasmim', units: [{ id: 'u4', label: 'Ap 12' }] },
  { id: 'p5', name: 'Rua Sete', units: [{ id: 'u5', label: 'Kitnet 4' }] },
]

type Opts = { mo?: unknown; la?: unknown; ls?: unknown; ts?: unknown; ps?: unknown }
function mockApi(o: Opts = {}) {
  const { mo = month, la = late, ls = leases, ts = tenants, ps = properties } = o
  goFetch.mockImplementation(async (path: string) => {
    const v =
      path.startsWith('/api/v1/payments?status=LATE') ? la
      : path.startsWith('/api/v1/payments?from=') ? mo
      : path === '/api/v1/leases' ? ls
      : path === '/api/v1/tenants' ? ts
      : path === '/api/v1/properties' ? ps
      : undefined
    if (v === undefined) throw new Error('rota inesperada ' + path)
    if (v instanceof Error) throw v
    return v
  })
}
async function renderPage(params: Record<string, string> = {}) {
  return render(await ReceivablesPage({ searchParams: Promise.resolve(params) }))
}
const rowOf = (name: string) => within(screen.getByRole('table')).getByText(name).closest('tr')!
const topButton = () => screen.getAllByRole('button', { name: 'Registrar pagamento' })[0]

beforeEach(() => {
  goFetch.mockReset()
  payReceivable.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
  refresh.mockReset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-07T15:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Recebimentos', () => {
  it('título, mês e navegação', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Recebimentos')
    expect(screen.getByText('Novembro de 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mês anterior' })).toHaveAttribute('href', '/financial/receivables?mes=2026-10')
    expect(screen.getByRole('link', { name: 'Próximo mês' })).toHaveAttribute('href', '/financial/receivables?mes=2026-12')
  })

  it('busca o mês pedido', async () => {
    mockApi()
    await renderPage({ mes: '2026-10' })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/payments?from=2026-10-01&to=2026-10-31', {})
    expect(screen.getByText('Outubro de 2026')).toBeInTheDocument()
  })

  it('indicadores do canvas (só aluguel, com a atrasada de outubro)', async () => {
    mockApi()
    await renderPage()
    const k = screen.getByRole('region', { name: 'Indicadores' })
    expect(k).toHaveTextContent('Previsto')
    expect(k).toHaveTextContent('R$ 8.300,00')
    expect(k).toHaveTextContent('5 cobranças')
    expect(k).toHaveTextContent('R$ 2.200,00')
    expect(k).toHaveTextContent('1 de 5 pagas')
    expect(k).toHaveTextContent('R$ 1.550,00')
    expect(k).toHaveTextContent('1 cobrança')
  })

  it('linha: inquilino, unidade, vencimento, valor e situação', async () => {
    mockApi()
    await renderPage()
    const row = rowOf('Marina Souza')
    for (const t of ['Ap 302 · Ed. Aurora', '05/11', 'R$ 1.850,00', 'Previsto']) expect(row).toHaveTextContent(t)
    expect(rowOf('Bruno Lima')).toHaveTextContent('Atrasado')
    expect(rowOf('Carla Dias')).toHaveTextContent('Pago')
  })

  it('uma ação por linha: Recibo, Cobrar ou Enviar cobrança', async () => {
    mockApi()
    await renderPage()
    expect(within(rowOf('Carla Dias')).getByRole('link', { name: 'Recibo' })).toHaveAttribute('href', '/financial/receivables/p4/receipt')
    expect(within(rowOf('Bruno Lima')).getByRole('link', { name: 'Cobrar' })).toHaveAttribute('href', '/financial/receivables/p3?enviar=1')
    expect(within(rowOf('Marina Souza')).getByRole('link', { name: 'Enviar cobrança' })).toHaveAttribute('href', '/financial/receivables/p1?enviar=1')
    expect(within(rowOf('Marina Souza')).queryByRole('button', { name: 'Registrar pagamento' })).toBeNull()
  })

  it('o nome do inquilino leva ao detalhe', async () => {
    mockApi()
    await renderPage()
    expect(within(rowOf('Marina Souza')).getByRole('link', { name: 'Marina Souza' })).toHaveAttribute('href', '/financial/receivables/p1')
  })

  it('chips com contagem e sem "Aguardando confirmação"', async () => {
    mockApi()
    await renderPage()
    const chips = screen.getByRole('navigation', { name: 'Situação' })
    for (const t of ['Todas · 5', 'Atrasadas · 1', 'Pagas · 1', 'Previstas · 3']) expect(within(chips).getByText(t)).toBeInTheDocument()
    expect(screen.queryByText(/Aguardando/)).not.toBeInTheDocument()
  })

  it('filtra por ?situacao=LATE', async () => {
    mockApi()
    await renderPage({ situacao: 'LATE' })
    const table = screen.getByRole('table')
    expect(within(table).getByText('Bruno Lima')).toBeInTheDocument()
    expect(within(table).queryByText('Marina Souza')).toBeNull()
  })

  it('filtro sem resultado', async () => {
    mockApi({ la: [] })
    await renderPage({ situacao: 'LATE' })
    expect(screen.getByText('Nenhuma cobrança encontrada.')).toBeInTheDocument()
  })

  it('mês sem cobranças explica de onde nascem', async () => {
    mockApi({ mo: [], la: [] })
    await renderPage()
    expect(screen.getByText('Nenhuma cobrança neste mês')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver contratos' })).toHaveAttribute('href', '/leases')
  })

  it('erro nas cobranças: mensagem e nova tentativa', async () => {
    mockApi({ mo: new Error('boom') })
    await renderPage()
    expect(screen.getByText('Não foi possível carregar os recebimentos.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar novamente' })).toHaveAttribute('href', '/financial/receivables?mes=2026-11')
  })

  it('sem contratos, inquilinos e imóveis: "—" e aviso', async () => {
    mockApi({ ls: new Error('x'), ts: new Error('y'), ps: new Error('z') })
    await renderPage()
    expect(rowOf('R$ 1.850,00')).toHaveTextContent('—')
    expect(screen.getByRole('status')).toHaveTextContent('contratos, inquilinos, imóveis')
  })

  it('cards no celular', async () => {
    mockApi()
    const { container } = await renderPage()
    expect(container.querySelectorAll('ul > li').length).toBe(5)
  })
})

describe('Registrar pagamento (botão do topo)', () => {
  it('abre com a primeira cobrança aberta e a data de hoje', async () => {
    mockApi()
    await renderPage()
    await userEvent.click(topButton())
    const d = screen.getByRole('dialog', { name: 'Registrar pagamento' })
    expect(within(d).getByLabelText('Cobrança')).toHaveTextContent('Bruno Lima')
    expect(within(d).getByLabelText('Data do pagamento')).toHaveValue('2026-11-07')
    expect(within(d).getByLabelText('Forma de pagamento')).toHaveTextContent('Pix')
  })

  it('atrasada mostra o total com multa e juros', async () => {
    mockApi()
    await renderPage()
    await userEvent.click(topButton())
    expect(screen.getByRole('status')).toHaveTextContent('R$ 1.591,33')
  })

  it('lista só as abertas', async () => {
    mockApi()
    await renderPage()
    await userEvent.click(topButton())
    await userEvent.click(screen.getByLabelText('Cobrança'))
    const opts = await screen.findAllByRole('option')
    expect(opts).toHaveLength(4)
    expect(opts.map((o) => o.textContent).join()).not.toContain('Carla Dias')
  })

  it('confirma: chama a action com o bruto e os campos, avisa e recarrega', async () => {
    mockApi()
    await renderPage()
    await userEvent.click(topButton())
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    await waitFor(() => expect(payReceivable).toHaveBeenCalledWith('p3', 1550, { paid_date: '2026-11-07', payment_method: 'PIX', discount_amount: '', payment_note: '' }))
    expect(toast.success).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('erro da action mantém o diálogo e avisa', async () => {
    payReceivable.mockResolvedValue({ error: 'Esta cobrança já foi baixada.' })
    mockApi()
    await renderPage()
    await userEvent.click(topButton())
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esta cobrança já foi baixada.'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
