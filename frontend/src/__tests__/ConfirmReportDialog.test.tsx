import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const confirmReport = vi.hoisted(() => vi.fn())
const rejectReport = vi.hoisted(() => vi.fn())
vi.mock('@/app/financial/actions', () => ({ confirmReport, rejectReport }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { ConfirmReportDialog, type ReportInfo } from '@/components/financial/ConfirmReportDialog'

const info: ReportInfo = {
  paymentId: 'p1',
  tenantName: 'Marina Souza',
  reportedAmount: 'R$ 1.850,00',
  reportedWhen: 'Hoje, 09:12',
  hasProof: true,
  differsFromDue: false,
  dueTotal: 'R$ 1.850,00',
}

const setup = (over: Partial<ReportInfo> = {}) => {
  const onClose = vi.fn()
  const onDone = vi.fn()
  render(<ConfirmReportDialog open info={{ ...info, ...over }} onClose={onClose} onDone={onDone} />)
  return { onClose, onDone }
}

beforeEach(() => {
  confirmReport.mockReset().mockResolvedValue({ success: true })
  rejectReport.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
})

describe('ConfirmReportDialog', () => {
  it('fechado: nada na tela', () => {
    render(<ConfirmReportDialog open={false} info={info} onClose={vi.fn()} onDone={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mostra quem informou, quando, o valor, o comprovante e o aviso de que não verificamos', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Confirmar pagamento de Marina?' })).toBeInTheDocument()
    expect(screen.getByText('Informado por Marina')).toBeInTheDocument()
    expect(screen.getByText('Hoje, 09:12')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.850,00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver comprovante/ })).toHaveAttribute('href', '/api/payments/p1/proof')
    expect(screen.getByText(/O ImoviFlow não verifica se o dinheiro entrou/)).toBeInTheDocument()
    expect(screen.getByText(/Confira na sua conta/)).toBeInTheDocument()
  })

  it('sem comprovante', () => {
    setup({ hasProof: false })
    expect(screen.queryByRole('link', { name: /Ver comprovante/ })).not.toBeInTheDocument()
    expect(screen.getByText('Sem comprovante')).toBeInTheDocument()
  })

  it('valor diferente do devido: mostra a diferença', () => {
    setup({ differsFromDue: true, reportedAmount: 'R$ 1.800,00', dueTotal: 'R$ 1.850,00' })
    expect(screen.getByText(/valor devido hoje é R\$ 1\.850,00/i)).toBeInTheDocument()
  })

  it('Confirmar recebimento baixa a cobrança e fecha', async () => {
    const { onDone, onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }))
    await waitFor(() => expect(confirmReport).toHaveBeenCalledWith('p1'))
    expect(toast.success).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('Ainda não recebi recusa o aviso', async () => {
    const { onDone } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Ainda não recebi' }))
    await waitFor(() => expect(rejectReport).toHaveBeenCalledWith('p1'))
    expect(confirmReport).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })

  it('erro mantém o diálogo aberto e avisa', async () => {
    confirmReport.mockResolvedValue({ error: 'Esta cobrança já está paga.' })
    const { onDone, onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esta cobrança já está paga.'))
    expect(onDone).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
