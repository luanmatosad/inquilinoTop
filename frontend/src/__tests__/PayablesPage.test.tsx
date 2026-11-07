import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
const actions = vi.hoisted(() => ({ createPayable: vi.fn(), payExpense: vi.fn(), unpayExpense: vi.fn() }))
vi.mock('@/app/financial/actions', () => actions)
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() },
  search: '',
}))
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  usePathname: () => '/financial/payables',
  useSearchParams: () => new URLSearchParams(nav.search),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import PayablesPage from '@/app/financial/payables/page'

const U1 = '5f0b6c1e-4f4a-4b5c-8e0a-1f2d3c4b5a69'
const U2 = '6f0b6c1e-4f4a-4b5c-8e0a-1f2d3c4b5a69'
const exp = (id: string, description: string, unit_id: string, category: string, amount: number, due: string, status: string) => ({
  id, description, unit_id, category, amount, status, due_date: `${due}T00:00:00Z`,
})
const month = [
  exp('e1', 'Pintura da sala', U1, 'MAINTENANCE', 800, '2026-11-12', 'PENDING'),
  exp('e2', 'Condomínio de novembro', U2, 'CONDO', 680, '2026-11-05', 'PAID'),
  exp('e3', 'IPTU · parcela 11', U2, 'TAX', 420, '2026-11-10', 'PAID'),
]
const late = [exp('e4', 'Conta de luz', U1, 'ELECTRICITY', 240, '2026-10-30', 'LATE')]
const properties = [
  { id: 'p1', name: 'Ed. Aurora', units: [{ id: U1, label: 'Ap 302' }] },
  { id: 'p2', name: 'Ed. Jasmim', units: [{ id: U2, label: 'Ap 12' }] },
]

type Opts = { mo?: unknown; la?: unknown; ps?: unknown }
function mockApi(o: Opts = {}) {
  const { mo = month, la = late, ps = properties } = o
  goFetch.mockImplementation(async (path: string) => {
    const v =
      path.startsWith('/api/v1/expenses?status=LATE') ? la
      : path.startsWith('/api/v1/expenses?from=') ? mo
      : path === '/api/v1/properties' ? ps
      : undefined
    if (v === undefined) throw new Error('rota inesperada ' + path)
    if (v instanceof Error) throw v
    return v
  })
}
async function renderPage(params: Record<string, string> = {}) {
  return render(await PayablesPage({ searchParams: Promise.resolve(params) }))
}
const rowOf = (name: string) => within(screen.getByRole('table')).getByText(name).closest('tr')!

beforeEach(() => {
  goFetch.mockReset()
  actions.createPayable.mockReset().mockResolvedValue({ success: true })
  actions.payExpense.mockReset().mockResolvedValue({ success: true })
  actions.unpayExpense.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
  Object.values(nav.router).forEach((f) => f.mockReset())
  nav.search = ''
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-07T15:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Despesas · lista', () => {
  it('título, mês e botão Lançar despesa', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Despesas')
    expect(screen.getByText('Novembro de 2026')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Lançar despesa' })[0]).toHaveAttribute('href', '/financial/payables?mes=2026-11&novo=1')
  })

  it('busca o mês e as atrasadas', async () => {
    mockApi()
    await renderPage({ mes: '2026-10' })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/expenses?from=2026-10-01&to=2026-10-31', {})
    expect(goFetch).toHaveBeenCalledWith('/api/v1/expenses?status=LATE', {})
  })

  it('indicadores', async () => {
    mockApi()
    await renderPage()
    const k = screen.getByRole('region', { name: 'Indicadores' })
    expect(k).toHaveTextContent('Total do mês')
    expect(k).toHaveTextContent('R$ 2.140,00')
    expect(k).toHaveTextContent('4 despesas')
    expect(k).toHaveTextContent('R$ 1.100,00')
    expect(k).toHaveTextContent('2 despesas')
    expect(k).toHaveTextContent('R$ 1.040,00')
  })

  it('linha: unidade, categoria, vencimento, valor e situação', async () => {
    mockApi()
    await renderPage()
    const row = rowOf('Pintura da sala')
    for (const t of ['Ap 302 · Ed. Aurora', 'Manutenção', '12/11', 'R$ 800,00', 'A pagar']) expect(row).toHaveTextContent(t)
    expect(rowOf('Conta de luz')).toHaveTextContent('Atrasada')
    expect(rowOf('IPTU · parcela 11')).toHaveTextContent('Paga')
  })

  it('colunas', async () => {
    mockApi()
    await renderPage()
    for (const h of ['Despesa e imóvel', 'Categoria', 'Vence em', 'Valor', 'Situação']) {
      expect(within(screen.getByRole('table')).getByRole('columnheader', { name: h })).toBeInTheDocument()
    }
  })

  it('chips: A pagar inclui atrasadas', async () => {
    mockApi()
    await renderPage({ situacao: 'PENDING' })
    const chips = screen.getByRole('navigation', { name: 'Situação' })
    for (const t of ['Todas · 4', 'A pagar · 2', 'Pagas · 2']) expect(within(chips).getByText(t)).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Conta de luz')).toBeInTheDocument()
    expect(within(table).queryByText('IPTU · parcela 11')).toBeNull()
  })

  it('mês vazio convida a lançar a primeira despesa', async () => {
    mockApi({ mo: [], la: [] })
    await renderPage()
    expect(screen.getByText('Lance sua primeira despesa')).toBeInTheDocument()
  })

  it('erro: mensagem e nova tentativa', async () => {
    mockApi({ la: new Error('x') })
    await renderPage()
    expect(screen.getByText('Não foi possível carregar as despesas.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar novamente' })).toHaveAttribute('href', '/financial/payables?mes=2026-11')
  })

  it('imóveis fora do ar: "—" e aviso', async () => {
    mockApi({ ps: new Error('z') })
    await renderPage()
    expect(rowOf('Pintura da sala')).toHaveTextContent('—')
    expect(screen.getByRole('status')).toHaveTextContent('Imóveis indisponíveis')
  })

  it('cards no celular', async () => {
    mockApi()
    const { container } = await renderPage()
    expect(container.querySelectorAll('ul > li').length).toBe(4)
  })
})

describe('Despesas · baixa e estorno', () => {
  it('dar baixa envia a data (e valor opcional vazio)', async () => {
    mockApi()
    await renderPage()
    await userEvent.click(within(rowOf('Pintura da sala')).getByRole('button', { name: 'Dar baixa' }))
    const d = screen.getByRole('dialog', { name: 'Dar baixa' })
    expect(within(d).getByLabelText('Data do pagamento')).toHaveValue('2026-11-07')
    await userEvent.click(within(d).getByRole('button', { name: 'Confirmar baixa' }))
    await waitFor(() => expect(actions.payExpense).toHaveBeenCalledWith('e1', { paid_date: '2026-11-07', paid_amount: '' }))
    expect(nav.router.refresh).toHaveBeenCalled()
  })

  it('desfazer pagamento pede confirmação e estorna', async () => {
    mockApi()
    await renderPage()
    await userEvent.click(within(rowOf('IPTU · parcela 11')).getByRole('button', { name: 'Desfazer pagamento' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(actions.unpayExpense).toHaveBeenCalledWith('e3'))
    expect(nav.router.refresh).toHaveBeenCalled()
  })

  it('erro na baixa avisa e mantém o diálogo', async () => {
    actions.payExpense.mockResolvedValue({ error: 'Esta despesa já está paga.' })
    mockApi()
    await renderPage()
    await userEvent.click(within(rowOf('Pintura da sala')).getByRole('button', { name: 'Dar baixa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baixa' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esta despesa já está paga.'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('Despesas · lançar', () => {
  beforeEach(() => {
    nav.search = 'mes=2026-11&novo=1'
  })

  it('painel com os campos do canvas', async () => {
    mockApi()
    await renderPage({ novo: '1' })
    const d = screen.getByRole('dialog', { name: 'Lançar despesa' })
    for (const l of ['Descrição', 'Unidade', 'Categoria', 'Valor', 'Vencimento']) expect(within(d).getByText(l)).toBeInTheDocument()
    expect(within(d).getByText('Já paguei')).toBeInTheDocument()
    expect(within(d).queryByText(/Repetir todo mês/)).not.toBeInTheDocument()
    expect(within(d).queryByText(/comprovante/i)).not.toBeInTheDocument()
  })

  it('?unidade= pré-seleciona', async () => {
    mockApi()
    await renderPage({ novo: '1', unidade: U1 })
    expect(screen.getByLabelText('Unidade')).toHaveTextContent('Ap 302')
  })

  it('validação: não envia vazio', async () => {
    mockApi()
    await renderPage({ novo: '1' })
    await userEvent.click(screen.getByRole('button', { name: 'Salvar despesa' }))
    await waitFor(() => expect(screen.getByLabelText('Unidade')).toHaveAttribute('aria-invalid', 'true'))
    expect(actions.createPayable).not.toHaveBeenCalled()
  })

  it('"Já paguei" pede a data e leva paid_date', async () => {
    mockApi()
    await renderPage({ novo: '1', unidade: U1 })
    const d = screen.getByRole('dialog')
    await userEvent.type(within(d).getByLabelText('Descrição'), 'Pintura da sala')
    await userEvent.click(within(d).getByLabelText('Categoria'))
    await userEvent.click(await screen.findByRole('option', { name: 'Manutenção' }))
    await userEvent.type(within(d).getByLabelText('Valor'), '800,00')
    await userEvent.type(within(d).getByLabelText('Vencimento'), '2026-11-12')
    await userEvent.click(within(d).getByRole('switch', { name: 'Já paguei' }))
    expect(within(d).getByLabelText('Data do pagamento')).toHaveValue('2026-11-07')
    await userEvent.click(within(d).getByRole('button', { name: 'Salvar despesa' }))
    await waitFor(() => expect(actions.createPayable).toHaveBeenCalled())
    expect(actions.createPayable.mock.calls[0][0]).toMatchObject({ unit_id: U1, category: 'MAINTENANCE', amount: '800,00', paid: true, paid_date: '2026-11-07' })
    await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/financial/payables?mes=2026-11'))
  })

  it('Cancelar tira só o parâmetro do painel', async () => {
    nav.search = 'mes=2026-11&novo=1&unidade=x'
    mockApi()
    await renderPage({ novo: '1' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(nav.router.replace).toHaveBeenCalledWith('/financial/payables?mes=2026-11')
  })
})
