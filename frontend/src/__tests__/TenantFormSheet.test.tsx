import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createTenant = vi.hoisted(() => vi.fn())
const updateTenant = vi.hoisted(() => vi.fn())
const deleteTenant = vi.hoisted(() => vi.fn())
vi.mock('@/app/tenants/actions', () => ({ createTenant, updateTenant, deleteTenant }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() },
  search: '',
}))
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  usePathname: () => '/tenants',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

import { TenantFormSheet } from '@/components/tenants/TenantFormSheet'

const tenant = { id: 't1', name: 'Marina Souza', person_type: 'PF' as const, email: 'marina@email.com' }

beforeEach(() => {
  createTenant.mockReset().mockResolvedValue({ success: true })
  updateTenant.mockReset().mockResolvedValue({ success: true })
  deleteTenant.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
  Object.values(nav.router).forEach((f) => f.mockReset())
  nav.search = 'novo=1'
})

describe('TenantFormSheet · cadastro', () => {
  it('fechado quando open é falso', () => {
    render(<TenantFormSheet open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre com título e descrição do canvas, sem opção de excluir', () => {
    render(<TenantFormSheet open />)
    const dialog = screen.getByRole('dialog', { name: 'Novo inquilino' })
    expect(dialog).toHaveTextContent('Nome e contato já bastam para começar.')
    expect(within(dialog).queryByRole('button', { name: 'Excluir inquilino' })).not.toBeInTheDocument()
  })

  it('Cancelar tira só o ?novo da URL', async () => {
    nav.search = 'novo=1&q=marina'
    render(<TenantFormSheet open />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(nav.router.replace).toHaveBeenCalledWith('/tenants?q=marina')
  })

  it('salvar fecha o painel', async () => {
    render(<TenantFormSheet open />)
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Marina Souza')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar inquilino' }))
    await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/tenants'))
  })

  it('erro de validação mantém o painel aberto', async () => {
    render(<TenantFormSheet open />)
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar inquilino' }))
    expect(await screen.findByText('O nome deve ter pelo menos 3 caracteres')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(nav.router.replace).not.toHaveBeenCalled()
  })

  it('reabre quando a URL volta a ter ?novo=1', () => {
    const { rerender } = render(<TenantFormSheet open={false} />)
    rerender(<TenantFormSheet open />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('TenantFormSheet · edição', () => {
  beforeEach(() => {
    nav.search = 'editar=1'
  })

  it('abre como "Editar inquilino" com o nome na descrição', () => {
    render(<TenantFormSheet open tenant={tenant} />)
    const dialog = screen.getByRole('dialog', { name: 'Editar inquilino' })
    expect(dialog).toHaveTextContent('Marina Souza')
    expect(within(dialog).getByLabelText('Nome completo')).toHaveValue('Marina Souza')
  })

  it('fechar tira só o ?editar da URL', async () => {
    render(<TenantFormSheet open tenant={tenant} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(nav.router.replace).toHaveBeenCalledWith('/tenants')
  })

  it('excluir pede confirmação, apaga e volta para a lista', async () => {
    render(<TenantFormSheet open tenant={tenant} />)
    await userEvent.click(screen.getByRole('button', { name: 'Excluir inquilino' }))
    expect(deleteTenant).not.toHaveBeenCalled() // ainda não confirmou
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar exclusão' }))
    await waitFor(() => expect(deleteTenant).toHaveBeenCalledWith('t1'))
    await waitFor(() => expect(nav.router.push).toHaveBeenCalledWith('/tenants'))
  })

  it('contrato ativo: mostra o motivo e mantém o inquilino', async () => {
    deleteTenant.mockResolvedValue({ error: 'Este inquilino tem contrato ativo. Encerre o contrato antes de excluir.' })
    render(<TenantFormSheet open tenant={tenant} />)
    await userEvent.click(screen.getByRole('button', { name: 'Excluir inquilino' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar exclusão' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Este inquilino tem contrato ativo. Encerre o contrato antes de excluir.'),
    )
    expect(nav.router.push).not.toHaveBeenCalled()
  })

  it('cancelar a confirmação não exclui', async () => {
    render(<TenantFormSheet open tenant={tenant} />)
    await userEvent.click(screen.getByRole('button', { name: 'Excluir inquilino' }))
    const alert = await screen.findByRole('alertdialog')
    await userEvent.click(within(alert).getByRole('button', { name: 'Cancelar' }))
    expect(deleteTenant).not.toHaveBeenCalled()
  })
})
