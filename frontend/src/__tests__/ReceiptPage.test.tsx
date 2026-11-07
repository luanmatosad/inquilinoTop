import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }))
vi.mock('next/navigation', () => ({ notFound, useRouter: () => ({}) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

import ReceiptPage from '@/app/financial/receivables/[id]/receipt/page'

const receipt = {
  payment_id: 'p1',
  number: '0001/2026',
  competency: '2026-11',
  issued_at: '2026-11-02T15:00:00Z',
  owner: { name: 'Luan Matos de Abreu Dias', document: '12345678909' },
  tenant: { name: 'Marina Souza', document: '12345678909' },
  unit: { label: 'Apartamento 302', property_address: 'Rua Quinze, 120' },
  amounts: { gross: 1850, late_fee: 0, interest: 0, discount: 0, irrf_withheld: 0, net_paid: 1850 },
  payment_method: 'PIX',
  paid_date: '2026-11-02T00:00:00Z',
  legal_note: 'Recibo emitido conforme Lei 8.245/91, art. 22, IV.',
}

function mockReceipt(r: unknown) {
  goFetch.mockImplementation(async () => {
    if (r instanceof Error) throw r
    return r
  })
}
async function renderPage() {
  return render(await ReceiptPage({ params: Promise.resolve({ id: 'p1' }) }))
}

beforeEach(() => {
  goFetch.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('recibo', () => {
  it('número, valor e texto com o valor por extenso', async () => {
    mockReceipt(receipt)
    await renderPage()
    expect(screen.getByText('Nº 0001/2026')).toBeInTheDocument()
    const text = screen.getByText(/Recebi de/)
    expect(text).toHaveTextContent('Marina Souza')
    expect(text).toHaveTextContent('123.456.***-09')
    expect(text).toHaveTextContent('mil oitocentos e cinquenta reais')
    expect(text).toHaveTextContent('aluguel de novembro de 2026')
    expect(text).toHaveTextContent('Apartamento 302')
    expect(text).toHaveTextContent('Rua Quinze, 120')
  })

  it('forma e data do pagamento', async () => {
    mockReceipt(receipt)
    await renderPage()
    expect(screen.getByText('Pago por Pix em 02/11/2026.')).toBeInTheDocument()
  })

  it('assinatura do dono e nota legal', async () => {
    mockReceipt(receipt)
    await renderPage()
    expect(screen.getByText('Luan Matos de Abreu Dias')).toBeInTheDocument()
    expect(screen.getByText(/Lei 8\.245/)).toBeInTheDocument()
    expect(screen.getByText(/Recibo gerado pelo ImoviFlow em 02\/11\/2026/)).toBeInTheDocument()
  })

  it('com desconto, multa e juros: composição e extenso com centavos', async () => {
    mockReceipt({
      ...receipt,
      amounts: { gross: 1550, late_fee: 31, interest: 4.13, discount: 0, irrf_withheld: 0, net_paid: 1585.13 },
    })
    await renderPage()
    expect(screen.getByText(/Recebi de/)).toHaveTextContent('mil quinhentos e oitenta e cinco reais e treze centavos')
    const table = screen.getByRole('table')
    expect(table).toHaveTextContent('Multa')
    expect(table).toHaveTextContent('Juros')
    expect(screen.queryByText('Desconto')).not.toBeInTheDocument()
  })

  it('desconto aparece no recibo', async () => {
    mockReceipt({ ...receipt, amounts: { ...receipt.amounts, discount: 50, net_paid: 1800 } })
    await renderPage()
    expect(screen.getByRole('table')).toHaveTextContent('Desconto')
    expect(screen.getByRole('table')).toHaveTextContent('R$ 50,00')
    expect(screen.getByText(/Recebi de/)).toHaveTextContent('mil e oitocentos reais')
  })

  it('Baixar PDF imprime a página', async () => {
    mockReceipt(receipt)
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    await renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF' }))
    expect(print).toHaveBeenCalled()
  })

  it('cobrança não paga: explica e volta aos recebimentos', async () => {
    mockReceipt(Object.assign(new Error('x'), { status: 409 }))
    await renderPage()
    expect(screen.getByText(/o recibo só existe depois do pagamento/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Recebimentos/ })).toHaveAttribute('href', '/financial/receivables')
  })

  it('inexistente: não encontrado', async () => {
    mockReceipt(Object.assign(new Error('x'), { status: 404 }))
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
