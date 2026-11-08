import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const reportPayment = vi.hoisted(() => vi.fn())
vi.mock('@/app/p/[token]/actions', () => ({ reportPayment }))
const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => nav }))

import { ReportForm } from '@/components/public-charge/ReportForm'

const props = { token: 'tok', today: '2026-11-07', defaultAmount: 1850 }

beforeEach(() => {
  reportPayment.mockReset().mockResolvedValue({ success: true })
  nav.replace.mockReset()
  nav.refresh.mockReset()
})

describe('ReportForm', () => {
  it('vem com o valor da cobrança e a data de hoje', () => {
    render(<ReportForm {...props} />)
    expect(screen.getByLabelText('Valor que você pagou')).toHaveValue('1850,00')
    expect(screen.getByLabelText('Data do pagamento')).toHaveValue('2026-11-07')
  })

  it('envia valor e data e volta para a página', async () => {
    const user = userEvent.setup()
    render(<ReportForm {...props} />)
    await user.click(screen.getByRole('button', { name: 'Avisar que paguei' }))
    await waitFor(() => expect(reportPayment).toHaveBeenCalled())
    const [token, fd] = reportPayment.mock.calls[0] as [string, FormData]
    expect(token).toBe('tok')
    expect(fd.get('amount')).toBe('1850,00')
    expect(fd.get('paid_date')).toBe('2026-11-07')
    expect(fd.get('proof')).toBeNull()
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/p/tok'))
  })

  it('valor zero: mostra o erro e não envia', async () => {
    const user = userEvent.setup()
    render(<ReportForm {...props} />)
    const amount = screen.getByLabelText('Valor que você pagou')
    await user.clear(amount)
    await user.type(amount, '0')
    await user.click(screen.getByRole('button', { name: 'Avisar que paguei' }))
    expect(await screen.findByText('Informe um valor maior que zero')).toBeInTheDocument()
    expect(reportPayment).not.toHaveBeenCalled()
  })

  it('comprovante: aceita PDF e recusa arquivo de tipo errado antes de enviar', async () => {
    // O navegador filtra por `accept`, mas o formulário não confia nisso: valida o tipo de novo.
    const user = userEvent.setup({ applyAccept: false })
    render(<ReportForm {...props} />)
    const input = screen.getByLabelText(/Anexar comprovante/) as HTMLInputElement

    await user.upload(input, new File(['x'], 'virus.html', { type: 'text/html' }))
    await user.click(screen.getByRole('button', { name: 'Avisar que paguei' }))
    expect(await screen.findByText(/foto \(JPEG ou PNG\) ou um PDF/)).toBeInTheDocument()
    expect(reportPayment).not.toHaveBeenCalled()

    await user.upload(input, new File(['%PDF'], 'comprovante.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: 'Avisar que paguei' }))
    await waitFor(() => expect(reportPayment).toHaveBeenCalled())
    expect((reportPayment.mock.calls[0][1] as FormData).get('proof')).toBeInstanceOf(File)
  })

  it('erro do servidor aparece e o formulário continua', async () => {
    reportPayment.mockResolvedValue({ error: 'Este link expirou.' })
    const user = userEvent.setup()
    render(<ReportForm {...props} />)
    await user.click(screen.getByRole('button', { name: 'Avisar que paguei' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Este link expirou.')
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('Voltar leva à cobrança', () => {
    render(<ReportForm {...props} />)
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/p/tok')
  })
})
