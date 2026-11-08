import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

vi.mock('@/app/financial/actions', () => ({ payReceivable: vi.fn(), confirmReport: vi.fn(), rejectReport: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/financial/receivables',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

import { ReceivablesList, type ReceivableItem } from '@/components/financial/ReceivablesList'

const row = (over: Partial<ReceivableItem>): ReceivableItem => ({
  id: 'p1',
  tenant: 'Marina Souza',
  where: 'Ap 302 · Ed. Aurora',
  due: '05/11',
  amount: 'R$ 1.850,00',
  grossAmount: 1850,
  totalDue: 1850,
  situation: 'PENDING',
  ...over,
})

const awaiting = row({
  situation: 'AWAITING',
  report: { amount: 'R$ 1.850,00', when: 'Hoje, 09:12', hasProof: true, differsFromDue: false },
})

describe('Recebimentos — aguardando confirmação', () => {
  it('mostra o selo e a ação Confirmar (no lugar de Enviar cobrança)', () => {
    render(<ReceivablesList rows={[awaiting]} openRows={[awaiting]} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Aguardando confirmação')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Enviar cobrança' })).not.toBeInTheDocument()
  })

  it('Confirmar abre o diálogo com o aviso do inquilino', async () => {
    render(<ReceivablesList rows={[awaiting]} openRows={[awaiting]} />)
    await userEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('dialog', { name: 'Confirmar pagamento de Marina?' })).toBeInTheDocument()
    expect(screen.getByText('Informado por Marina')).toBeInTheDocument()
  })

  it('demais linhas seguem com a ação de sempre', () => {
    render(<ReceivablesList rows={[row({ id: 'p2' }), row({ id: 'p3', situation: 'LATE' })]} openRows={[]} />)
    const table = screen.getByRole('table')
    expect(within(table).getByRole('link', { name: 'Enviar cobrança' })).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: 'Cobrar' })).toBeInTheDocument()
  })
})
