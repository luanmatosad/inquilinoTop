import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createProperty = vi.hoisted(() => vi.fn())
const updateProperty = vi.hoisted(() => vi.fn())
vi.mock('@/app/properties/actions', () => ({ createProperty, updateProperty }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

import { PropertyForm } from '@/components/properties/PropertyForm'

beforeEach(() => {
  createProperty.mockReset().mockResolvedValue({ success: true, data: { id: 'p1' } })
  updateProperty.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
  Object.values(router).forEach((f) => f.mockReset())
})

describe('PropertyForm · campos do canvas', () => {
  it('mostra CEP, nome, tipo, endereço, número, complemento, bairro, cidade e UF', () => {
    render(<PropertyForm />)
    for (const label of ['CEP', 'Nome do imóvel', 'Endereço', 'Número', 'Complemento (opcional)', 'Bairro', 'Cidade', 'UF']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    for (const t of ['Casa', 'Residencial', 'Comercial']) {
      expect(screen.getByRole('radio', { name: t })).toBeInTheDocument()
    }
    expect(screen.queryByRole('radio', { name: 'Terreno' })).not.toBeInTheDocument()
  })

  it('explica quantas unidades cada tipo tem', () => {
    render(<PropertyForm />)
    expect(
      screen.getByText('Residencial e comercial têm várias unidades. Casa tem uma só, cadastrada junto com o imóvel.'),
    ).toBeInTheDocument()
  })

  it('não promete preenchimento automático do CEP (fica para depois)', () => {
    render(<PropertyForm />)
    expect(screen.queryByText(/preenche o endereço sozinho/i)).not.toBeInTheDocument()
  })
})

describe('PropertyForm · cadastro', () => {
  it('sem nome: mostra o erro no campo e não chama o backend', async () => {
    const onSuccess = vi.fn()
    render(<PropertyForm onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar imóvel' }))
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument()
    expect(createProperty).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('envia os campos, inclusive tipo, número e complemento, e avisa o sucesso', async () => {
    const onSuccess = vi.fn()
    render(<PropertyForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText('Nome do imóvel'), 'Centro Empresarial')
    await userEvent.click(screen.getByRole('radio', { name: 'Comercial' }))
    await userEvent.type(screen.getByLabelText('Endereço'), 'Av. Parintins')
    await userEvent.type(screen.getByLabelText('Número'), '300')
    await userEvent.type(screen.getByLabelText('Complemento (opcional)'), 'Sala 2')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar imóvel' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(createProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Centro Empresarial',
        type: 'COMMERCIAL',
        address_line: 'Av. Parintins',
        number: '300',
        complement: 'Sala 2',
      }),
    )
    expect(toast.success).toHaveBeenCalled()
  })

  it('erro do backend: mostra aviso e não conclui', async () => {
    createProperty.mockResolvedValue({ error: 'Erro ao criar propriedade' })
    const onSuccess = vi.fn()
    render(<PropertyForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText('Nome do imóvel'), 'Casa')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar imóvel' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao criar propriedade'))
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('Cancelar chama onCancel', async () => {
    const onCancel = vi.fn()
    render(<PropertyForm onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('PropertyForm · edição (aba Informações)', () => {
  const initial = {
    id: 'p1',
    name: 'Ed. Aurora',
    type: 'RESIDENTIAL' as const,
    address_line: 'Rua Quinze',
    number: '120',
    complement: 'Bloco B',
    neighborhood: 'Centro',
    city: 'Itacoatiara',
    state: 'AM',
    postal_code: '69100000',
  }

  it('abre com os valores atuais e o CEP mascarado', () => {
    render(<PropertyForm initialData={initial} />)
    expect(screen.getByLabelText('Nome do imóvel')).toHaveValue('Ed. Aurora')
    expect(screen.getByLabelText('Número')).toHaveValue('120')
    expect(screen.getByLabelText('Complemento (opcional)')).toHaveValue('Bloco B')
    expect(screen.getByLabelText('CEP')).toHaveValue('69100-000')
    expect(screen.getByRole('radio', { name: 'Residencial' })).toBeChecked()
  })

  it('salva, permanece na página e atualiza os dados', async () => {
    render(<PropertyForm initialData={initial} />)
    await userEvent.clear(screen.getByLabelText('Número'))
    await userEvent.type(screen.getByLabelText('Número'), '130')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ number: '130' })))
    expect(router.refresh).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })
})
