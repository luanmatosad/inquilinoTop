import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const recordPaymentEvent = vi.hoisted(() => vi.fn())
const createPaymentLink = vi.hoisted(() => vi.fn())
vi.mock('@/app/financial/actions', () => ({ recordPaymentEvent, createPaymentLink }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() },
  search: 'enviar=1',
}))
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  usePathname: () => '/financial/receivables/p1',
  useSearchParams: () => new URLSearchParams(nav.search),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

import { SendChargeDialog } from '@/components/financial/SendChargeDialog'

const base = {
  open: true,
  paymentId: 'p1',
  late: false,
  tenantName: 'Marina Souza',
  tenantPhone: '11988881111',
  tenantEmail: 'marina@email.com',
  month: 'novembro',
  where: 'Ap 302 · Ed. Aurora',
  amount: 1850,
  dueLabel: '05/11',
  pix: '000201PIXCODE',
  ownerFirstName: 'Luan',
}

beforeEach(() => {
  recordPaymentEvent.mockReset().mockResolvedValue({ success: true })
  createPaymentLink.mockReset().mockResolvedValue({ url: 'https://app.imoviflow.test/p/TOKEN123' })
  Object.values(toast).forEach((f) => f.mockReset())
  Object.values(nav.router).forEach((f) => f.mockReset())
  nav.search = 'enviar=1'
})

describe('SendChargeDialog', () => {
  it('fechado quando open é falso', () => {
    render(<SendChargeDialog {...base} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mensagem pronta com nome, mês, unidade, valor, vencimento e Pix', () => {
    render(<SendChargeDialog {...base} />)
    const msg = screen.getByLabelText('Mensagem') as HTMLTextAreaElement
    for (const t of ['Oi, Marina!', 'aluguel de novembro', 'Ap 302 · Ed. Aurora', '1.850,00', 'vence em 05/11', '000201PIXCODE', '— Luan']) {
      expect(msg.value).toContain(t)
    }
  })

  it('atrasada: título de cobrar de novo e texto de lembrete', () => {
    render(<SendChargeDialog {...base} late amount={1585.13} dueLabel="25/10" />)
    expect(screen.getByRole('dialog', { name: 'Cobrar de novo' })).toBeInTheDocument()
    expect((screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value).toContain('venceu em 25/10')
  })

  it('Abrir WhatsApp usa o texto editado', async () => {
    render(<SendChargeDialog {...base} />)
    const msg = screen.getByLabelText('Mensagem')
    await userEvent.clear(msg)
    await userEvent.type(msg, 'Texto novo')
    const link = screen.getByRole('link', { name: 'Abrir WhatsApp' })
    expect(link).toHaveAttribute('href', 'https://wa.me/5511988881111?text=' + encodeURIComponent('Texto novo'))
  })

  it('sem celular válido: WhatsApp desabilitado com a dica', () => {
    render(<SendChargeDialog {...base} tenantPhone="123" />)
    expect(screen.queryByRole('link', { name: 'Abrir WhatsApp' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir WhatsApp' })).toBeDisabled()
    expect(screen.getByText(/Cadastre o celular do inquilino/)).toBeInTheDocument()
  })

  it('e-mail: mailto com assunto e corpo; desabilitado sem e-mail', async () => {
    const { unmount } = render(<SendChargeDialog {...base} />)
    await userEvent.click(screen.getByRole('button', { name: 'E-mail' }))
    const link = screen.getByRole('link', { name: 'Abrir e-mail' })
    expect(link.getAttribute('href')).toMatch(/^mailto:marina@email\.com\?subject=/)
    unmount()
    render(<SendChargeDialog {...base} tenantEmail={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'E-mail' }))
    expect(screen.getByRole('button', { name: 'Abrir e-mail' })).toBeDisabled()
  })

  it('sem Pix: mensagem sem o código e aviso com link', () => {
    render(<SendChargeDialog {...base} pix={null} />)
    expect((screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value).not.toContain('Pix')
    expect(screen.getByRole('alert')).toHaveTextContent('Chave Pix não cadastrada')
    expect(screen.getByRole('link', { name: 'Cadastrar chave' })).toHaveAttribute('href', '/settings/pix')
  })

  it('Copiar mensagem copia o texto atual', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<SendChargeDialog {...base} />)
    await userEvent.click(screen.getByRole('button', { name: 'Copiar mensagem' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith((screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value))
    expect(toast.success).toHaveBeenCalledWith('Mensagem copiada.')
  })

  it('Marcar como enviada grava SENT pelo canal escolhido e fecha só o parâmetro', async () => {
    render(<SendChargeDialog {...base} />)
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como enviada' }))
    await waitFor(() => expect(recordPaymentEvent).toHaveBeenCalledWith('p1', 'SENT', 'WHATSAPP'))
    expect(nav.router.replace).toHaveBeenCalledWith('/financial/receivables/p1')
    expect(nav.router.refresh).toHaveBeenCalled()
  })

  it('atrasada grava REMINDER; e-mail grava EMAIL', async () => {
    render(<SendChargeDialog {...base} late />)
    await userEvent.click(screen.getByRole('button', { name: 'E-mail' }))
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como enviada' }))
    await waitFor(() => expect(recordPaymentEvent).toHaveBeenCalledWith('p1', 'REMINDER', 'EMAIL'))
  })

  it('erro ao gravar mantém o diálogo e avisa', async () => {
    recordPaymentEvent.mockResolvedValue({ error: 'Esta cobrança já está paga.' })
    render(<SendChargeDialog {...base} />)
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como enviada' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esta cobrança já está paga.'))
    expect(nav.router.replace).not.toHaveBeenCalled()
  })

  it('Cancelar fecha só o parâmetro', async () => {
    nav.search = 'enviar=1&x=1'
    render(<SendChargeDialog {...base} />)
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Voltar' }))
    expect(nav.router.replace).toHaveBeenCalledWith('/financial/receivables/p1?x=1')
  })

  it('Gerar link coloca o endereço na mensagem e avisa que o anterior deixa de valer', async () => {
    render(<SendChargeDialog {...base} />)
    expect(screen.getByText(/desativa o anterior/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Gerar link de pagamento' }))
    await waitFor(() => expect(createPaymentLink).toHaveBeenCalledWith('p1'))
    const msg = (screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value
    expect(msg).toContain('https://app.imoviflow.test/p/TOKEN123')
    expect(msg).not.toContain('000201PIXCODE')
    expect(screen.queryByRole('button', { name: 'Gerar link de pagamento' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gerar novo link' })).toBeInTheDocument()
  })

  it('mensagem editada: o link entra no fim, sem apagar o texto', async () => {
    render(<SendChargeDialog {...base} />)
    const msg = screen.getByLabelText('Mensagem')
    await userEvent.clear(msg)
    await userEvent.type(msg, 'Texto meu')
    await userEvent.click(screen.getByRole('button', { name: 'Gerar link de pagamento' }))
    await waitFor(() => expect((msg as HTMLTextAreaElement).value).toContain('https://app.imoviflow.test/p/TOKEN123'))
    expect((msg as HTMLTextAreaElement).value.startsWith('Texto meu')).toBe(true)
  })

  it('erro ao gerar o link avisa e mantém a mensagem', async () => {
    createPaymentLink.mockResolvedValue({ error: 'Configure APP_PUBLIC_URL.' })
    render(<SendChargeDialog {...base} />)
    await userEvent.click(screen.getByRole('button', { name: 'Gerar link de pagamento' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Configure APP_PUBLIC_URL.'))
    expect((screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value).toContain('000201PIXCODE')
  })
})
