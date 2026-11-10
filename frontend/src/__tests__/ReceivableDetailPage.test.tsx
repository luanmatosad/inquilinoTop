import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('@/lib/go/session-user', () => ({ sessionUserId: async () => 'user-1' }))
vi.mock('@/app/financial/actions', () => ({ payReceivable: vi.fn(), recordPaymentEvent: vi.fn(), createAgreement: vi.fn(), createPaymentLink: vi.fn(), confirmReport: vi.fn(), rejectReport: vi.fn() }))
vi.mock('@/app/settings/profile/actions', () => ({ getProfile: async () => ({ full_name: 'Luan Matos' }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/financial/receivables/p1',
  useSearchParams: () => new URLSearchParams(),
  notFound,
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import ReceivablePage from '@/app/financial/receivables/[id]/page'

const open = {
  id: 'p1', lease_id: 'l1', type: 'RENT', status: 'PENDING', competency: '2026-11',
  due_date: '2026-11-20T00:00:00Z', gross_amount: 1850, late_fee_amount: 0, interest_amount: 0, discount_amount: 0,
}
const late = {
  ...open, status: 'LATE', competency: '2026-10', due_date: '2026-10-30T00:00:00Z',
  gross_amount: 1550, late_fee_amount: 31, interest_amount: 4.13,
}
const paid = {
  ...open, status: 'PAID', paid_date: '2026-11-02T00:00:00Z', net_amount: 1800, discount_amount: 50,
  payment_method: 'PIX', receipt_number: 1, receipt_year: 2026,
}
const lease = { id: 'l1', tenant_id: 't1', unit_id: 'u302', start_date: '2025-03-10T00:00:00Z', late_fee_percent: 2, daily_interest_percent: 0.033333 }
const tenants = [{ id: 't1', name: 'Marina Souza', email: 'marina@email.com', phone: '11988881111' }]
const properties = [{ id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u302', label: 'Ap 302' }] }]
const events = [
  { kind: 'CREATED', at: '2026-10-01T03:00:00Z', synthetic: true },
  { kind: 'SENT', at: '2026-10-02T12:00:00Z', channel: 'WHATSAPP', actor_id: 'user-1' },
]

type Opts = { pay?: unknown; ev?: unknown; ls?: unknown; ts?: unknown; ps?: unknown; cfg?: unknown }
function mockApi(o: Opts = {}) {
  const { pay = open, ev = events, ls = lease, ts = tenants, ps = properties, cfg = { pix_key: '11999998888' } } = o
  goFetch.mockImplementation(async (path: string) => {
    const v =
      path === '/api/v1/payments/p1' ? pay
      : path === '/api/v1/payments/p1/events' ? ev
      : path === '/api/v1/leases/l1' ? ls
      : path === '/api/v1/tenants' ? ts
      : path === '/api/v1/properties' ? ps
      : path === '/api/v1/payments/config' ? cfg
      : path === '/api/v1/payments/p1/pix' ? { payload: '000201PIX', amount: 1850 }
      : undefined
    if (v === undefined) throw new Error('rota inesperada ' + path)
    if (v instanceof Error) throw v
    return v
  })
}
async function renderPage(search: Record<string, string> = {}) {
  return render(await ReceivablePage({ params: Promise.resolve({ id: 'p1' }), searchParams: Promise.resolve(search) }))
}

beforeEach(() => {
  goFetch.mockReset()
  notFound.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-07T15:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('detalhe da cobrança', () => {
  it('cabeçalho e dados da cobrança em dia', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Marina Souza')
    expect(screen.getByText(/Ap 302 · Ed\. Aurora · aluguel de novembro/)).toBeInTheDocument()
    const c = screen.getByRole('region', { name: 'Cobrança' })
    expect(c).toHaveTextContent('R$ 1.850,00')
    expect(c).toHaveTextContent('20/11/2026')
    expect(c).toHaveTextContent('2% + 1% ao mês')
    expect(c).toHaveTextContent('Chave Pix cadastrada')
  })

  it('ações da cobrança aberta apontam para os painéis', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByRole('link', { name: 'Enviar cobrança' })).toHaveAttribute('href', '/financial/receivables/p1?enviar=1')
    expect(screen.getByRole('link', { name: 'Registrar pagamento' })).toHaveAttribute('href', '/financial/receivables/p1?pagar=1')
    expect(screen.queryByRole('link', { name: 'Negociar atraso' })).not.toBeInTheDocument()
  })

  it('atrasada: dias, decomposição e Negociar atraso', async () => {
    mockApi({ pay: late })
    await renderPage()
    expect(screen.getByText(/8 dias de atraso/)).toBeInTheDocument()
    const b = screen.getByRole('region', { name: 'Valor atualizado hoje' })
    for (const t of ['Aluguel', 'R$ 1.550,00', 'Multa (2%)', 'R$ 31,00', 'Juros (1% ao mês · 8 dias)', 'R$ 4,13', 'Total hoje', 'R$ 1.585,13']) {
      expect(b).toHaveTextContent(t)
    }
    expect(screen.getByRole('link', { name: 'Negociar atraso' })).toHaveAttribute('href', '/financial/receivables/p1?acordo=1')
    expect(screen.getByRole('link', { name: 'Cobrar de novo' })).toHaveAttribute('href', '/financial/receivables/p1?enviar=1')
  })

  it('linha do tempo com "por você"', async () => {
    mockApi()
    await renderPage()
    const t = screen.getByRole('region', { name: 'Linha do tempo' })
    expect(t).toHaveTextContent('Cobrança criada')
    expect(t).toHaveTextContent('Enviada por WhatsApp')
    expect(t).toHaveTextContent('02/10, 09:00 · por você')
  })

  it('paga: forma, desconto e recibo, sem botões de envio e acordo', async () => {
    mockApi({ pay: paid })
    await renderPage()
    const c = screen.getByRole('region', { name: 'Cobrança' })
    expect(c).toHaveTextContent('Pago em 02/11/2026')
    expect(c).toHaveTextContent('Pix')
    expect(c).toHaveTextContent('R$ 50,00')
    expect(screen.getByRole('link', { name: /Recibo/ })).toHaveAttribute('href', '/financial/receivables/p1/receipt')
    for (const n of ['Enviar cobrança', 'Cobrar de novo', 'Negociar atraso', 'Registrar pagamento']) {
      expect(screen.queryByRole('link', { name: n })).not.toBeInTheDocument()
    }
  })

  it('sem chave Pix: aviso com link para as configurações', async () => {
    mockApi({ cfg: new Error('404') })
    await renderPage()
    const c = screen.getByRole('region', { name: 'Cobrança' })
    expect(c).toHaveTextContent('Chave Pix não cadastrada')
    expect(within(c).getByRole('link', { name: 'Cadastrar chave' })).toHaveAttribute('href', '/settings/pix')
  })

  it('inquilino: contato e contrato', async () => {
    mockApi()
    await renderPage()
    const i = screen.getByRole('region', { name: 'Inquilino' })
    expect(i).toHaveTextContent('(11) 98888-1111')
    expect(within(i).getByRole('link', { name: /desde 10\/03\/2025/ })).toHaveAttribute('href', '/leases/l1')
  })

  it('inexistente: página de não encontrado', async () => {
    mockApi({ pay: new Error('404') })
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('eventos, inquilino e imóveis fora do ar: degrada com aviso', async () => {
    mockApi({ ev: new Error('x'), ts: new Error('y'), ps: new Error('z'), ls: new Error('w') })
    await renderPage()
    expect(screen.getByText('Não foi possível carregar a linha do tempo.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('—')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Cobrança' })).toHaveTextContent('R$ 1.850,00')
  })

  it('?enviar=1 abre o envio com o Pix na mensagem', async () => {
    mockApi()
    await renderPage({ enviar: '1' })
    const d = screen.getByRole('dialog', { name: 'Enviar cobrança' })
    const msg = within(d).getByLabelText('Mensagem') as HTMLTextAreaElement
    expect(msg.value).toContain('000201PIX')
    expect(msg.value).toContain('— Luan')
  })

  it('?enviar=1 sem chave Pix: mensagem sem código', async () => {
    goFetch.mockImplementation(async (path: string) => {
      if (path.endsWith('/pix')) throw new Error('422')
      if (path === '/api/v1/payments/p1') return open
      if (path === '/api/v1/payments/p1/events') return events
      if (path === '/api/v1/leases/l1') return lease
      if (path === '/api/v1/tenants') return tenants
      if (path === '/api/v1/properties') return properties
      if (path === '/api/v1/payments/config') return {}
      throw new Error('rota inesperada ' + path)
    })
    await renderPage({ enviar: '1' })
    expect(screen.getByRole('alert')).toHaveTextContent('Chave Pix não cadastrada')
  })

  it('?pagar=1 abre o registro de pagamento', async () => {
    mockApi()
    await renderPage({ pagar: '1' })
    expect(screen.getByRole('dialog', { name: 'Registrar pagamento' })).toBeInTheDocument()
  })

  it('?acordo=1 abre a negociação só quando atrasada', async () => {
    mockApi({ pay: late })
    await renderPage({ acordo: '1' })
    expect(screen.getByRole('dialog', { name: 'Negociar atraso' })).toBeInTheDocument()
  })

  it('?acordo=1 em cobrança em dia não abre nada', async () => {
    mockApi()
    await renderPage({ acordo: '1' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('aviso do inquilino: selo, resumo e Confirmar que abre o diálogo', async () => {
    mockApi({
      pay: { ...open, awaiting_confirmation: true, reported_amount: 1850, reported_at: '2026-11-07T12:12:00Z', reported_date: '2026-11-06T00:00:00Z', has_proof: true },
    })
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aguardando confirmação')
    const notice = screen.getByRole('region', { name: 'Aviso do inquilino' })
    expect(within(notice).getByText(/1\.850,00/)).toBeInTheDocument()
    await userEvent.click(within(notice).getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('dialog', { name: 'Confirmar pagamento de Marina?' })).toBeInTheDocument()
  })

  it('sem aviso não mostra a seção', async () => {
    mockApi()
    await renderPage()
    expect(screen.queryByRole('region', { name: 'Aviso do inquilino' })).not.toBeInTheDocument()
  })
})
