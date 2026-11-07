import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const endLease = vi.hoisted(() => vi.fn())
const readjustLease = vi.hoisted(() => vi.fn())
vi.mock('@/app/leases/actions', () => ({ endLease, readjustLease }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const nav = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }, search: '' }))
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  usePathname: () => '/leases/l1',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

import { EndLeaseDialog } from '@/components/leases/EndLeaseDialog'
import { ReadjustSheet } from '@/components/leases/ReadjustSheet'

beforeEach(() => {
  endLease.mockReset().mockResolvedValue({ success: true, data: { payments_canceled: 3, payments_need_review: 1 } })
  readjustLease.mockReset().mockResolvedValue({ success: true, data: { payments_updated: 7, payments_need_review: 1 } })
  Object.values(toast).forEach((f) => f.mockReset())
  Object.values(nav.router).forEach((f) => f.mockReset())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-06T15:00:00Z'))
  nav.search = 'encerrar=1'
})
afterEach(() => {
  vi.useRealTimers()
})

describe('EndLeaseDialog', () => {
  const ui = <EndLeaseDialog open leaseId="l1" unitId="u1" title="Apartamento 302 · Ed. Aurora" />

  it('explica o efeito com a data', () => {
    render(ui)
    expect(screen.getByText(/O contrato encerra em 06\/11\/2026/)).toBeInTheDocument()
  })

  it('avisa quando a data está no passado', async () => {
    render(ui)
    const input = screen.getByLabelText('Data de saída')
    await userEvent.clear(input)
    await userEvent.type(input, '2026-10-01')
    expect(screen.getByRole('alert')).toHaveTextContent('A data está no passado')
  })

  it('exige o motivo', async () => {
    render(ui)
    await userEvent.click(screen.getByRole('button', { name: 'Encerrar contrato' }))
    await waitFor(() => expect(screen.getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true'))
    expect(endLease).not.toHaveBeenCalled()
  })

  it('envia data e motivo, mostra contagens e fecha só o parâmetro', async () => {
    render(ui)
    await userEvent.click(screen.getByLabelText('Motivo'))
    await userEvent.click(await screen.findByRole('option', { name: 'Pedido do inquilino' }))
    await userEvent.click(screen.getByRole('button', { name: 'Encerrar contrato' }))
    await waitFor(() => expect(endLease).toHaveBeenCalledWith('l1', { end_date: '2026-11-06', reason: 'TENANT_REQUEST' }, 'u1'))
    expect(toast.success).toHaveBeenCalledWith('Contrato encerrado. 3 cobrança(s) futura(s) cancelada(s).')
    expect(toast.warning).toHaveBeenCalledWith('1 cobrança(s) já emitida(s) precisam de revisão manual.')
    expect(nav.router.replace).toHaveBeenCalledWith('/leases/l1')
  })

  it('Voltar fecha sem enviar', async () => {
    render(ui)
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(endLease).not.toHaveBeenCalled()
    expect(nav.router.replace).toHaveBeenCalledWith('/leases/l1')
  })
})

describe('ReadjustSheet', () => {
  const ui = (phone: string | null = '11988881111') => (
    <ReadjustSheet open leaseId="l1" currentRent={1550} defaultIndex="IGP-M" defaultDate="2027-03-01" tenantName="Marina Souza" tenantPhone={phone} />
  )
  beforeEach(() => {
    nav.search = 'reajustar=1'
  })

  it('prévia: 1.550,00 + 4,5%', async () => {
    render(ui())
    await userEvent.type(screen.getByLabelText('Percentual (%)'), '4,5')
    expect(screen.getByText(/R\$\s1\.550,00 → R\$\s1\.619,75 \(\+R\$\s69,75\)/)).toBeInTheDocument()
  })

  it('percentual inválido não envia', async () => {
    render(ui())
    await userEvent.type(screen.getByLabelText('Percentual (%)'), '0')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar reajuste' }))
    expect(await screen.findByText(/percentual entre 0,1 e 100/)).toBeInTheDocument()
    expect(readjustLease).not.toHaveBeenCalled()
  })

  it('envia índice e vigência, informa cobranças e oferece WhatsApp', async () => {
    render(ui())
    await userEvent.type(screen.getByLabelText('Percentual (%)'), '4,5')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar reajuste' }))
    await waitFor(() => expect(readjustLease).toHaveBeenCalled())
    expect(readjustLease.mock.calls[0][1]).toMatchObject({ percentage: '4,5', applied_at: '2027-03-01', index_name: 'IGP-M' })
    expect(await screen.findByRole('status')).toHaveTextContent('7 cobrança(s) futura(s) atualizada(s)')
    expect(screen.getByRole('alert')).toHaveTextContent('1 cobrança(s) já emitida(s)')
    expect(screen.getByRole('link', { name: 'Avisar pelo WhatsApp' })).toHaveAttribute('href', expect.stringContaining('https://wa.me/5511988881111'))
  })

  it('sem celular válido não há WhatsApp', async () => {
    render(ui('123'))
    await userEvent.type(screen.getByLabelText('Percentual (%)'), '4,5')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar reajuste' }))
    await screen.findByRole('status')
    expect(screen.queryByRole('link', { name: 'Avisar pelo WhatsApp' })).not.toBeInTheDocument()
  })
})
