import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }))
vi.mock('next/navigation', () => ({ notFound }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

import PublicReceiptPage from '@/app/p/[token]/recibo/page'

const receipt = {
  number: '0001/2026',
  competency: '2026-11',
  issued_at: '2026-11-02T15:00:00Z',
  paid_date: '2026-11-02T00:00:00Z',
  payment_method: 'PIX',
  owner: { name: 'Luan Matos' },
  tenant: { name: 'Marina Souza' },
  unit: { label: 'Ap 302' },
  amounts: { gross: 1850, late_fee: 0, interest: 0, discount: 0, irrf_withheld: 0, net_paid: 1850 },
  legal_note: 'Recibo emitido conforme Lei 8.245/91, art. 22, IV.',
}
const httpError = (status: number, code: string) => Object.assign(new Error(code), { status, code })

async function renderPage() {
  return render(await PublicReceiptPage({ params: Promise.resolve({ token: 'tok' }) }))
}

beforeEach(() => {
  goFetch.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('recibo público', () => {
  it('número, partes, valor por extenso, sem documento nem endereço', async () => {
    goFetch.mockResolvedValue(receipt)
    await renderPage()
    expect(goFetch).toHaveBeenCalledWith('/api/v1/public/payments/tok/receipt', { skipAuth: true })
    expect(screen.getByText('Nº 0001/2026')).toBeInTheDocument()
    const text = screen.getByText(/Recebi de/)
    expect(text).toHaveTextContent('Marina Souza')
    expect(text).toHaveTextContent('mil oitocentos e cinquenta reais')
    expect(text).toHaveTextContent('aluguel de novembro de 2026')
    expect(text).toHaveTextContent('Ap 302')
    expect(text).not.toHaveTextContent(/documento/)
    expect(screen.getByText('Luan Matos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/p/tok')
  })

  it('ainda não paga: explica e volta à cobrança', async () => {
    goFetch.mockRejectedValue(httpError(409, 'NOT_PAID'))
    await renderPage()
    expect(screen.getByText(/só existe depois do pagamento/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/p/tok')
  })

  it('link inválido: 404', async () => {
    goFetch.mockRejectedValue(httpError(404, 'NOT_FOUND'))
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
