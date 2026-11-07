import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createAgreement = vi.hoisted(() => vi.fn())
vi.mock('@/app/financial/actions', () => ({ createAgreement }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const nav = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }, search: 'acordo=1' }))
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  usePathname: () => '/financial/receivables/p1',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

import { AgreementSheet } from '@/components/financial/AgreementSheet'

const props = { open: true, paymentId: 'p1', tenantName: 'Bruno Lima', today: '2026-11-07', total: 1585.13 }

beforeEach(() => {
  createAgreement.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
  Object.values(nav.router).forEach((f) => f.mockReset())
  nav.search = 'acordo=1'
})

describe('AgreementSheet', () => {
  it('fechado quando open é falso', () => {
    render(<AgreementSheet {...props} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mostra o total de hoje e sugere esse valor', () => {
    render(<AgreementSheet {...props} />)
    const d = screen.getByRole('dialog', { name: 'Negociar atraso' })
    expect(d).toHaveTextContent('Total hoje')
    expect(d).toHaveTextContent('1.585,13')
    expect(screen.getByLabelText('Valor a receber')).toHaveValue('1585,13')
  })

  it('não oferece Parcelar nem pausar lembretes', () => {
    render(<AgreementSheet {...props} />)
    expect(screen.queryByText(/Parcelar/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pausar lembretes/)).not.toBeInTheDocument()
  })

  it('novo vencimento no passado ou hoje: erro e não envia', async () => {
    render(<AgreementSheet {...props} />)
    await userEvent.type(screen.getByLabelText('Novo vencimento'), '2026-11-07')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar acordo' }))
    expect(await screen.findByText('O novo vencimento deve ser depois de hoje')).toBeInTheDocument()
    expect(createAgreement).not.toHaveBeenCalled()
  })

  it('valor editável e envio com a data, o valor e a observação', async () => {
    render(<AgreementSheet {...props} />)
    await userEvent.type(screen.getByLabelText('Novo vencimento'), '2026-11-12')
    const v = screen.getByLabelText('Valor a receber')
    await userEvent.clear(v)
    await userEvent.type(v, '1550,00')
    await userEvent.type(screen.getByLabelText('Observação'), 'combinado por WhatsApp')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar acordo' }))
    await waitFor(() => expect(createAgreement).toHaveBeenCalledWith(
      'p1',
      { new_due_date: '2026-11-12', agreed_amount: '1550,00', note: 'combinado por WhatsApp' },
      '2026-11-07',
    ))
    expect(toast.success).toHaveBeenCalledWith('Acordo registrado.')
    expect(nav.router.replace).toHaveBeenCalledWith('/financial/receivables/p1')
    expect(nav.router.refresh).toHaveBeenCalled()
  })

  it('erro do backend aparece no campo e mantém o painel', async () => {
    createAgreement.mockResolvedValue({ error: 'x', fieldErrors: { new_due_date: ['O novo vencimento deve ser depois de hoje.'] } })
    render(<AgreementSheet {...props} />)
    await userEvent.type(screen.getByLabelText('Novo vencimento'), '2026-11-12')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar acordo' }))
    expect(await screen.findByText('O novo vencimento deve ser depois de hoje.')).toBeInTheDocument()
    expect(nav.router.replace).not.toHaveBeenCalled()
  })

  it('Cancelar tira só o parâmetro', async () => {
    nav.search = 'acordo=1&x=1'
    render(<AgreementSheet {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(nav.router.replace).toHaveBeenCalledWith('/financial/receivables/p1?x=1')
  })
})
