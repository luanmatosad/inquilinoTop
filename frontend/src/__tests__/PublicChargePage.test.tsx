import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }))
vi.mock('next/navigation', () => ({ notFound, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))
vi.mock('qrcode', () => ({ default: { toString: vi.fn(async () => '<svg data-testid="qr"></svg>') } }))
vi.mock('@/app/p/[token]/actions', () => ({ reportPayment: vi.fn() }))

import PublicChargePage from '@/app/p/[token]/page'

const charge = {
  landlord_name: 'Luan Matos',
  amount: 1850,
  due_date: '2026-11-05T00:00:00Z',
  unit_label: 'Ap 302',
  competency: '2026-11',
  status: 'PENDING',
}
const pix = { payload: '000201PIXCODE', amount: 1850 }

type Routes = { charge?: unknown; pix?: unknown | Error }
function mockApi({ charge: c = charge, pix: p = pix }: Routes = {}) {
  goFetch.mockImplementation(async (path: string) => {
    const payload = path.endsWith('/pix') ? p : c
    if (payload instanceof Error) throw payload
    return payload
  })
}
const httpError = (status: number, code: string) => Object.assign(new Error(code), { status, code })

async function renderPage(search: Record<string, string> = {}) {
  return render(await PublicChargePage({ params: Promise.resolve({ token: 'tok' }), searchParams: Promise.resolve(search) }))
}

beforeEach(() => {
  goFetch.mockReset()
  notFound.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('página pública da cobrança', () => {
  it('em aberto: locador, valor, unidade, vencimento, Pix e "Já paguei"', async () => {
    mockApi()
    await renderPage()
    expect(screen.getByText('Luan Matos')).toBeInTheDocument()
    expect(screen.getByText('Aluguel de novembro')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.850,00')).toBeInTheDocument()
    expect(screen.getByText(/Ap 302/)).toBeInTheDocument()
    expect(screen.getByText('05/11/2026')).toBeInTheDocument()
    expect(screen.getByText('000201PIXCODE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar código Pix' })).toBeInTheDocument()
    expect(screen.getByTestId('qr')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Já paguei' })).toHaveAttribute('href', '/p/tok?avisar=1')
    expect(screen.getByText(/não recebe nem guarda seu dinheiro/)).toBeInTheDocument()
  })

  it('busca sem credenciais (a página é pública)', async () => {
    mockApi()
    await renderPage()
    for (const call of goFetch.mock.calls) expect(call[1]).toMatchObject({ skipAuth: true })
    expect(goFetch.mock.calls.map((c) => c[0])).toContain('/api/v1/public/payments/tok')
  })

  it('atrasada: selo de atraso', async () => {
    mockApi({ charge: { ...charge, status: 'LATE', amount: 1891.93 } })
    await renderPage()
    expect(screen.getByText('Atrasada')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.891,93')).toBeInTheDocument()
  })

  it('Pix indisponível: avisa e não mostra copiar', async () => {
    mockApi({ pix: httpError(422, 'PIX_KEY_NOT_CONFIGURED') })
    await renderPage()
    expect(screen.getByText(/Pix não está disponível/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar código Pix' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Já paguei' })).toBeInTheDocument()
  })

  it('?avisar=1 abre o formulário do aviso', async () => {
    mockApi()
    await renderPage({ avisar: '1' })
    expect(screen.getByLabelText('Valor que você pagou')).toBeInTheDocument()
    expect(screen.getByLabelText('Data do pagamento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avisar que paguei' })).toBeInTheDocument()
    expect(screen.queryByText('000201PIXCODE')).not.toBeInTheDocument()
  })

  it('aguardando confirmação: passos e nome do locador', async () => {
    mockApi({ charge: { ...charge, status: 'AWAITING_CONFIRMATION', reported_at: '2026-11-07T12:12:00Z', reported_amount: 1850 } })
    await renderPage()
    expect(screen.getByText('Avisamos Luan')).toBeInTheDocument()
    expect(screen.getByText('Você avisou que pagou')).toBeInTheDocument()
    expect(screen.getByText('Luan confirma o pagamento')).toBeInTheDocument()
    expect(screen.getByText('Recibo disponível')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar código Pix' })).not.toBeInTheDocument()
    expect(goFetch.mock.calls.map((c) => c[0])).not.toContain('/api/v1/public/payments/tok/pix')
  })

  it('paga: selo com a data e link do recibo', async () => {
    mockApi({ charge: { ...charge, status: 'PAID', paid_date: '2026-11-02T00:00:00Z', receipt_number: '0001/2026' } })
    await renderPage()
    expect(screen.getByText('Pago em 02/11')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Baixar recibo/ })).toHaveAttribute('href', '/p/tok/recibo')
    expect(screen.queryByRole('link', { name: 'Já paguei' })).not.toBeInTheDocument()
  })

  it('link inválido: 404', async () => {
    mockApi({ charge: httpError(404, 'NOT_FOUND') })
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
})
