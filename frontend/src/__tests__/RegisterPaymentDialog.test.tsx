import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const payReceivable = vi.hoisted(() => vi.fn())
vi.mock('@/app/financial/actions', () => ({ payReceivable }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const nav = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }, search: 'pagar=1' }))
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  usePathname: () => '/financial/receivables/p1',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

import { RegisterPaymentDialog, RegisterPaymentPanel } from '@/components/financial/RegisterPaymentDialog'
import type { ReceivableItem } from '@/components/financial/ReceivablesList'

const item = (o: Partial<ReceivableItem> = {}): ReceivableItem => ({
  id: 'p1', tenant: 'Marina Souza', where: 'Ap 302', due: '05/11', amount: 'R$ 1.850,00', grossAmount: 1850, totalDue: 1850, situation: 'PENDING', ...o,
})

beforeEach(() => {
  payReceivable.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
  Object.values(nav.router).forEach((f) => f.mockReset())
  nav.search = 'pagar=1'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-07T15:00:00Z'))
})

function open(items = [item()], onClose = vi.fn(), onDone = vi.fn()) {
  render(<RegisterPaymentDialog open initialId={items[0].id} items={items} onClose={onClose} onDone={onDone} />)
  return { onClose, onDone }
}

describe('RegisterPaymentDialog', () => {
  it('campos: cobrança, data de hoje, forma Pix, desconto e observação', () => {
    open()
    expect(screen.getByLabelText('Data do pagamento')).toHaveValue('2026-11-07')
    expect(screen.getByLabelText('Forma de pagamento')).toHaveTextContent('Pix')
    expect(screen.getByLabelText('Desconto (opcional)')).toHaveValue('')
    expect(screen.getByLabelText('Observação')).toBeInTheDocument()
    expect(screen.getByText(/Saldo depois deste pagamento/)).toBeInTheDocument()
  })

  it('o total a receber abate o desconto', async () => {
    open()
    expect(screen.getByText(/Total a receber:/).textContent).toContain('1.850,00')
    await userEvent.type(screen.getByLabelText('Desconto (opcional)'), '50,00')
    expect(screen.getByText(/Total a receber:/).textContent).toContain('1.800,00')
  })

  it('desconto maior que o devido: erro e não envia', async () => {
    open()
    await userEvent.type(screen.getByLabelText('Desconto (opcional)'), '2000')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await screen.findByText('O desconto não pode passar do valor devido')).toBeInTheDocument()
    expect(payReceivable).not.toHaveBeenCalled()
  })

  it('o limite do desconto acompanha a cobrança escolhida (atrasada inclui multa e juros)', async () => {
    open([item({ situation: 'LATE', totalDue: 1891.93, updatedTotal: 'R$ 1.891,93' })])
    await userEvent.type(screen.getByLabelText('Desconto (opcional)'), '1891,93')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    await waitFor(() => expect(payReceivable).toHaveBeenCalled())
  })

  it('envia forma, desconto e observação', async () => {
    const { onClose, onDone } = open()
    await userEvent.click(screen.getByLabelText('Forma de pagamento'))
    await userEvent.click(await screen.findByRole('option', { name: 'Dinheiro' }))
    await userEvent.type(screen.getByLabelText('Desconto (opcional)'), '50,00')
    await userEvent.type(screen.getByLabelText('Observação'), 'pagou na portaria')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    await waitFor(() => expect(payReceivable).toHaveBeenCalledWith('p1', 1850, {
      paid_date: '2026-11-07', payment_method: 'CASH', discount_amount: '50,00', payment_note: 'pagou na portaria',
    }))
    expect(toast.success).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })

  it('erro do backend no desconto aparece no campo', async () => {
    payReceivable.mockResolvedValue({ error: 'O desconto não pode passar do valor devido.', fieldErrors: { discount_amount: ['O desconto não pode passar do valor devido.'] } })
    const { onClose } = open()
    await userEvent.type(screen.getByLabelText('Desconto (opcional)'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await screen.findByText('O desconto não pode passar do valor devido.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('RegisterPaymentPanel (detalhe)', () => {
  it('abre por ?pagar=1 e fecha só o parâmetro', async () => {
    nav.search = 'pagar=1&x=1'
    render(<RegisterPaymentPanel open item={item()} />)
    expect(screen.getByRole('dialog', { name: 'Registrar pagamento' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(nav.router.replace).toHaveBeenCalledWith('/financial/receivables/p1?x=1')
  })

  it('fechado quando open é falso', () => {
    render(<RegisterPaymentPanel open={false} item={item()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
