import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createProperty = vi.hoisted(() => vi.fn())
vi.mock('@/app/properties/actions', () => ({ createProperty, updateProperty: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() },
  search: '',
}))
vi.mock('next/navigation', () => ({
  useRouter: () => nav.router,
  usePathname: () => '/properties',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

import { PropertyFormSheet } from '@/components/properties/PropertyFormSheet'

beforeEach(() => {
  createProperty.mockReset().mockResolvedValue({ success: true, data: { id: 'p1' } })
  Object.values(nav.router).forEach((f) => f.mockReset())
  nav.search = 'novo=1'
})

describe('PropertyFormSheet', () => {
  it('fica fechado quando open é falso', () => {
    render(<PropertyFormSheet open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre com título, descrição e o formulário', () => {
    render(<PropertyFormSheet open />)
    const dialog = screen.getByRole('dialog', { name: 'Novo imóvel' })
    expect(dialog).toHaveTextContent('Cadastre o prédio, a casa ou o ponto comercial.')
    expect(screen.getByLabelText('Nome do imóvel')).toBeInTheDocument()
  })

  it('Cancelar fecha o painel tirando só o ?novo da URL', async () => {
    nav.search = 'novo=1&q=aurora&tipo=RESIDENTIAL'
    render(<PropertyFormSheet open />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(nav.router.replace).toHaveBeenCalledWith('/properties?q=aurora&tipo=RESIDENTIAL')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('salvar fecha o painel e atualiza a lista', async () => {
    render(<PropertyFormSheet open />)
    await userEvent.type(screen.getByLabelText('Nome do imóvel'), 'Casa Nova')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar imóvel' }))
    await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/properties'))
    expect(nav.router.refresh).toHaveBeenCalled()
  })

  it('erro de validação mantém o painel aberto com a mensagem no campo', async () => {
    render(<PropertyFormSheet open />)
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar imóvel' }))
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(nav.router.replace).not.toHaveBeenCalled()
  })

  it('reabre quando a URL volta a ter ?novo=1', () => {
    const { rerender } = render(<PropertyFormSheet open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<PropertyFormSheet open />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
