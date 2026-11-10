import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createLease = vi.hoisted(() => vi.fn())
const updateLease = vi.hoisted(() => vi.fn())
vi.mock('@/app/leases/actions', () => ({ createLease, updateLease }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() },
  search: '',
}))
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  usePathname: () => '/leases',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

import { LeaseFormSheet } from '@/components/leases/LeaseFormSheet'

const U1 = '5f0b6c1e-4f4a-4b5c-8e0a-1f2d3c4b5a69'
const U2 = '6f0b6c1e-4f4a-4b5c-8e0a-1f2d3c4b5a69'
const T1 = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const units = [
  { id: U1, label: 'Apartamento 302', propertyName: 'Ed. Aurora', referenceRent: 1850 },
  { id: U2, label: 'Sala 3', propertyName: 'Centro Empresarial', referenceRent: 2200 },
]
const tenants = [{ id: T1, name: 'Marina Souza' }]
const lease = {
  id: 'l1', unit_id: U1, tenant_id: T1, start_date: '2025-03-10T00:00:00Z', end_date: '2028-03-10T00:00:00Z',
  rent_amount: 1850, payment_day: 5, adjustment_index: 'IGP-M', adjustment_month: 3,
  late_fee_percent: 2, daily_interest_percent: 0.033333, iptu_reimbursable: false, notes: 'Fiador: João',
}

beforeEach(() => {
  createLease.mockReset().mockResolvedValue({ success: true, data: { payments_generated: 12 } })
  updateLease.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
  Object.values(nav.router).forEach((f) => f.mockReset())
  nav.search = 'novo=1'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-06T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('LeaseFormSheet · criação', () => {
  it('fechado quando open é falso', () => {
    render(<LeaseFormSheet open={false} units={units} tenants={tenants} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('campos do canvas', () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} />)
    const d = screen.getByRole('dialog', { name: 'Novo contrato' })
    for (const l of ['Unidade', 'Inquilino', 'Valor do aluguel', 'Dia de vencimento', 'Início', 'Fim (opcional)', 'Índice de reajuste', 'Reajustar em', 'Observações']) {
      expect(within(d).getByText(l)).toBeInTheDocument()
    }
    expect(within(d).getByText(/Gerar as cobranças dos próximos 12 meses/)).toBeInTheDocument()
  })

  it('pré-seleciona inquilino e unidade, com aluguel sugerido', () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} defaultTenantId={T1} defaultUnitId={U1} />)
    expect(screen.getByLabelText('Inquilino')).toHaveTextContent('Marina Souza')
    expect(screen.getByLabelText('Unidade')).toHaveTextContent('Apartamento 302')
    expect(screen.getByLabelText('Valor do aluguel')).toHaveValue('1850')
    expect(screen.getByText('Sugerido pela unidade.')).toBeInTheDocument()
  })

  it('aluguel digitado é mantido ao trocar de unidade', async () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} defaultUnitId={U1} />)
    const rent = screen.getByLabelText('Valor do aluguel')
    await userEvent.clear(rent)
    await userEvent.type(rent, '1999')
    await userEvent.click(screen.getByLabelText('Unidade'))
    await userEvent.click(await screen.findByRole('option', { name: /Sala 3/ }))
    expect(rent).toHaveValue('1999')
    expect(screen.queryByText('Sugerido pela unidade.')).not.toBeInTheDocument()
  })

  it('sugestão acompanha a unidade enquanto não digitou', async () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} defaultUnitId={U1} />)
    await userEvent.click(screen.getByLabelText('Unidade'))
    await userEvent.click(await screen.findByRole('option', { name: /Sala 3/ }))
    expect(screen.getByLabelText('Valor do aluguel')).toHaveValue('2200')
  })

  it('mês de reajuste padrão é o do início', () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} />)
    expect(screen.getByLabelText('Reajustar em')).toHaveTextContent('Novembro')
  })

  it('multa e juros padrão ficam recolhidos até "Alterar neste contrato"', async () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} />)
    expect(screen.getByText(/Padrão: multa de 2% e juros de 1% ao mês/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Juros (% ao mês)')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Alterar neste contrato' }))
    expect(screen.getByLabelText('Juros (% ao mês)')).toHaveValue('1')
  })

  describe('padrões das Regras financeiras', () => {
    const defaults = { late_fee_percent: '3', monthly_interest_percent: '0,5', adjustment_index: 'IPCA' as const }

    it('contrato novo já vem com multa, juros e índice das regras', async () => {
      render(<LeaseFormSheet open units={units} tenants={tenants} defaults={defaults} />)
      expect(screen.getByText(/Padrão: multa de 3% e juros de 0,5% ao mês/)).toBeInTheDocument()
      expect(screen.getByLabelText('Índice de reajuste')).toHaveTextContent('IPCA')
      await userEvent.click(screen.getByRole('button', { name: 'Alterar neste contrato' }))
      expect(screen.getByLabelText('Multa por atraso (%)')).toHaveValue('3')
      expect(screen.getByLabelText('Juros (% ao mês)')).toHaveValue('0,5')
    })

    it('envia os padrões das regras', async () => {
      render(<LeaseFormSheet open units={units} tenants={tenants} defaultTenantId={T1} defaultUnitId={U1} defaults={defaults} />)
      await userEvent.click(screen.getByRole('button', { name: 'Criar contrato' }))
      await waitFor(() => expect(createLease).toHaveBeenCalled())
      expect(createLease.mock.calls[0][0]).toMatchObject({ late_fee_percent: '3', monthly_interest_percent: '0,5', adjustment_index: 'IPCA' })
    })

    it('multa zero nas regras vira campo vazio (sem multa) e o texto diz 0%', () => {
      render(<LeaseFormSheet open units={units} tenants={tenants} defaults={{ late_fee_percent: '', monthly_interest_percent: '', adjustment_index: '' }} />)
      expect(screen.getByText(/Padrão: multa de 0% e juros de 0% ao mês/)).toBeInTheDocument()
    })

    it('a edição continua com os valores do contrato, não os das regras', () => {
      nav.search = 'editar=1'
      render(<LeaseFormSheet open units={units} tenants={tenants} lease={lease} defaults={{ late_fee_percent: '9', monthly_interest_percent: '4', adjustment_index: 'IPCA' }} />)
      expect(screen.getByLabelText('Multa por atraso (%)')).toHaveValue('2')
    })
  })

  it('envia generate_payments, juros diários e fecha', async () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} defaultTenantId={T1} defaultUnitId={U1} />)
    await userEvent.click(screen.getByRole('button', { name: 'Criar contrato' }))
    await waitFor(() => expect(createLease).toHaveBeenCalled())
    expect(createLease.mock.calls[0][0]).toMatchObject({
      unit_id: U1, tenant_id: T1, rent_amount: '1850', generate_payments: true, late_fee_percent: '2', monthly_interest_percent: '1',
    })
    await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/leases'))
    expect(toast.success).toHaveBeenCalledWith('Contrato criado com 12 cobrança(s).')
  })

  it('LEASE_OVERLAP mantém o painel aberto com a mensagem', async () => {
    const msg = 'Esta unidade já tem contrato ativo no período informado.'
    createLease.mockResolvedValue({ error: msg, fieldErrors: { unit_id: [msg] } })
    render(<LeaseFormSheet open units={units} tenants={tenants} defaultTenantId={T1} defaultUnitId={U1} />)
    await userEvent.click(screen.getByRole('button', { name: 'Criar contrato' }))
    expect(await screen.findByText(msg)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(nav.router.replace).not.toHaveBeenCalled()
  })

  it('validação: sem unidade e inquilino não envia', async () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} />)
    await userEvent.click(screen.getByRole('button', { name: 'Criar contrato' }))
    await waitFor(() => expect(screen.getByLabelText('Unidade')).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByLabelText('Inquilino')).toHaveAttribute('aria-invalid', 'true')
    expect(createLease).not.toHaveBeenCalled()
  })

  it('Cancelar tira só os parâmetros do painel', async () => {
    nav.search = 'novo=1&inquilino=t1&q=marina'
    render(<LeaseFormSheet open units={units} tenants={tenants} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(nav.router.replace).toHaveBeenCalledWith('/leases?q=marina')
  })
})

describe('LeaseFormSheet · edição', () => {
  beforeEach(() => {
    nav.search = 'editar=1'
  })

  it('unidade, inquilino e início como texto, com os valores atuais', () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} lease={lease} />)
    const d = screen.getByRole('dialog', { name: 'Editar contrato' })
    expect(d).toHaveTextContent('Apartamento 302 · Ed. Aurora')
    expect(d).toHaveTextContent('Marina Souza · desde 10/03/2025')
    expect(screen.queryByLabelText('Unidade')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Valor do aluguel')).toHaveValue('1850')
    expect(screen.getByLabelText('Juros (% ao mês)')).toHaveValue('1')
    expect(screen.getByLabelText('Reajustar em')).toHaveTextContent('Março')
    expect(screen.getByLabelText('Observações')).toHaveValue('Fiador: João')
  })

  it('salva chamando updateLease com o id e não envia generate_payments', async () => {
    render(<LeaseFormSheet open units={units} tenants={tenants} lease={lease} />)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateLease).toHaveBeenCalled())
    expect(updateLease.mock.calls[0][0]).toBe('l1')
    expect(updateLease.mock.calls[0][1]).toMatchObject({ rent_amount: '1850', adjustment_index: 'IGP-M', adjustment_month: '3' })
    expect(updateLease.mock.calls[0][1].generate_payments).toBeUndefined()
    expect(createLease).not.toHaveBeenCalled()
  })
})
