import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
const closeMonth = vi.hoisted(() => vi.fn())
const reopenMonth = vi.hoisted(() => vi.fn())
vi.mock('@/app/financial/actions', () => ({ closeMonth, reopenMonth, payReceivable: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh, back: vi.fn() }),
  usePathname: () => '/financial/receivables/fechamento',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import ClosingPage from '@/app/financial/receivables/fechamento/page'
import ReceivablesPage from '@/app/financial/receivables/page'

const snapshot = {
  forecast: { count: 5, total: 8300 },
  received: { count: 4, total: 6750 },
  overdue: { count: 1, total: 1550 },
  receipts_issued: 4,
  pending: [{ payment_id: 'p1', tenant: 'Bruno Lima', amount: 1550, due_date: '2026-10-05', awaiting: false }],
}
const open = { month: '2026-10', status: 'OPEN', snapshot, events: [] }
const closed = {
  month: '2026-10',
  status: 'CLOSED',
  closed_at: '2026-11-03T00:05:00Z',
  closed_by_name: 'Luan Matos',
  snapshot,
  events: [
    { id: 'e1', kind: 'CLOSED', actor_name: 'Luan Matos', created_at: '2026-11-03T00:05:00Z' },
    { id: 'e2', kind: 'REOPENED', actor_name: 'Luan Matos', reason: 'corrigir baixa', created_at: '2026-11-04T12:00:00Z' },
  ],
}

function mockClosing(value: unknown) {
  goFetch.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/v1/closings')) {
      if (value instanceof Error) throw value
      return value
    }
    return []
  })
}
const renderClosing = async (mes = '2026-10') => render(await ClosingPage({ searchParams: Promise.resolve({ mes }) }))
const renderReceivables = async (mes: string) => render(await ReceivablesPage({ searchParams: Promise.resolve({ mes }) }))

beforeEach(() => {
  goFetch.mockReset()
  closeMonth.mockReset().mockResolvedValue({ success: true })
  reopenMonth.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
  refresh.mockReset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-07T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Fechamento: mês aberto', () => {
  it('mostra números, conferência e o botão Fechar', async () => {
    mockClosing(open)
    await renderClosing()
    expect(screen.getByRole('heading', { name: 'Fechar outubro de 2026' })).toBeTruthy()
    expect(screen.getByText('4 de 5 pagas')).toBeTruthy()
    expect(screen.getByText('Nenhum aguardando confirmação.')).toBeTruthy()
    expect(screen.getByText('4 de 4 pagamentos têm recibo.')).toBeTruthy()
    expect(screen.getByText('1 cobrança em atraso')).toBeTruthy()
    expect(screen.getByText('Bruno Lima · 05/10/2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fechar outubro' })).toBeTruthy()
  })

  it('confirma e fecha, avisando a pendência', async () => {
    mockClosing(open)
    const user = userEvent.setup()
    await renderClosing()
    await user.click(screen.getByRole('button', { name: 'Fechar outubro' }))
    expect(screen.getByText(/com 1 pendência \(Bruno Lima\)/)).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: 'Fechar outubro' })
    await user.click(buttons[buttons.length - 1])
    await waitFor(() => expect(closeMonth).toHaveBeenCalledWith('2026-10'))
    expect(toast.success).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('erro do servidor aparece no diálogo e não fecha', async () => {
    mockClosing(open)
    closeMonth.mockResolvedValue({ error: 'Este mês já está fechado.' })
    const user = userEvent.setup()
    await renderClosing()
    await user.click(screen.getByRole('button', { name: 'Fechar outubro' }))
    const buttons = screen.getAllByRole('button', { name: 'Fechar outubro' })
    await user.click(buttons[buttons.length - 1])
    expect((await screen.findByRole('alert')).textContent).toContain('já está fechado')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('mês em curso: sem botão Fechar', async () => {
    mockClosing({ ...open, month: '2026-11' })
    await renderClosing('2026-11')
    expect(screen.queryByRole('button', { name: /^Fechar/ })).toBeNull()
    expect(screen.getByText(/ainda não terminou/)).toBeTruthy()
  })

  it('falha ao carregar: mensagem e tentar de novo', async () => {
    mockClosing(new Error('boom'))
    await renderClosing()
    expect(screen.getByText('Não foi possível carregar o fechamento.')).toBeTruthy()
  })
})

describe('Fechamento: mês fechado', () => {
  it('somente leitura com autor, pendência e histórico', async () => {
    mockClosing(closed)
    await renderClosing()
    expect(screen.getByRole('heading', { name: 'Outubro de 2026' })).toBeTruthy()
    expect(screen.getByText('Fechado em 02/11/2026, 21:05')).toBeTruthy()
    expect(screen.getByText('Por Luan Matos · com 1 pendência (Bruno Lima)')).toBeTruthy()
    expect(screen.getByText('Motivo: corrigir baixa')).toBeTruthy()
    expect(screen.queryByText('Antes de fechar')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Fechar/ })).toBeNull()
  })

  it('reabrir exige o motivo', async () => {
    mockClosing(closed)
    const user = userEvent.setup()
    await renderClosing()
    await user.click(screen.getByRole('button', { name: 'Reabrir mês' }))
    const confirm = screen.getAllByRole('button', { name: 'Reabrir mês' }).pop()!
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByLabelText('Motivo'), 'corrigir baixa')
    expect((confirm as HTMLButtonElement).disabled).toBe(false)
    await user.click(confirm)
    await waitFor(() => expect(reopenMonth).toHaveBeenCalledWith('2026-10', 'corrigir baixa'))
    expect(refresh).toHaveBeenCalled()
  })
})

describe('Recebimentos: fechar o mês', () => {
  it('mês passado aberto mostra Fechar outubro', async () => {
    mockClosing(open)
    await renderReceivables('2026-10')
    expect(screen.getByRole('link', { name: 'Fechar outubro' }).getAttribute('href')).toBe('/financial/receivables/fechamento?mes=2026-10')
  })

  it('mês passado fechado mostra o selo', async () => {
    mockClosing(closed)
    await renderReceivables('2026-10')
    expect(screen.getByText('Mês fechado')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Fechar outubro' })).toBeNull()
  })

  it('mês corrente não mostra nada e nem consulta o fechamento', async () => {
    mockClosing(open)
    await renderReceivables('2026-11')
    expect(screen.queryByText('Mês fechado')).toBeNull()
    expect(screen.queryByRole('link', { name: /^Fechar/ })).toBeNull()
    expect(goFetch).not.toHaveBeenCalledWith(expect.stringContaining('/closings'), expect.anything())
  })
})
