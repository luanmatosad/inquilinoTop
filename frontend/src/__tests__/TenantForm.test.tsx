import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createTenant = vi.hoisted(() => vi.fn())
const updateTenant = vi.hoisted(() => vi.fn())
vi.mock('@/app/tenants/actions', () => ({ createTenant, updateTenant, deleteTenant: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { TenantForm } from '@/components/tenants/TenantForm'

const VALID_CPF = '52998224725'

beforeEach(() => {
  createTenant.mockReset().mockResolvedValue({ success: true })
  updateTenant.mockReset().mockResolvedValue({ success: true })
  Object.values(toast).forEach((f) => f.mockReset())
})

describe('TenantForm · campos do canvas', () => {
  it('mostra tipo, nome, CPF, e-mail, celular e observações', () => {
    render(<TenantForm />)
    expect(screen.getByRole('radio', { name: 'Pessoa física' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Empresa' })).toBeInTheDocument()
    for (const label of ['Nome completo', 'CPF', 'E-mail', 'Celular (WhatsApp)', 'Observações']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('explica para que serve o celular', () => {
    render(<TenantForm />)
    expect(screen.getByText('É por aqui que você envia as cobranças.')).toBeInTheDocument()
  })

  it('não pede endereço nem fiador', () => {
    render(<TenantForm />)
    for (const re of [/CEP/i, /Endereço/i, /Cidade/i, /UF/i, /Fiador/i]) {
      expect(screen.queryByLabelText(re)).not.toBeInTheDocument()
    }
    expect(screen.queryByText(/fiador/i)).not.toBeInTheDocument()
  })

  it('Empresa troca os rótulos para Razão social e CNPJ', async () => {
    render(<TenantForm />)
    await userEvent.click(screen.getByRole('radio', { name: 'Empresa' }))
    expect(screen.getByLabelText('Razão social')).toBeInTheDocument()
    expect(screen.getByLabelText('CNPJ')).toBeInTheDocument()
    expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument()
  })

  it('trocar o tipo limpa o documento digitado', async () => {
    render(<TenantForm />)
    await userEvent.type(screen.getByLabelText('CPF'), VALID_CPF)
    await userEvent.click(screen.getByRole('radio', { name: 'Empresa' }))
    expect(screen.getByLabelText('CNPJ')).toHaveValue('')
  })
})

describe('TenantForm · cadastro', () => {
  it('CPF inválido: erro no campo e nenhuma chamada ao backend', async () => {
    render(<TenantForm />)
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Marina Souza')
    await userEvent.type(screen.getByLabelText('CPF'), '11111111111')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar inquilino' }))
    expect(await screen.findByText('CPF inválido')).toBeInTheDocument()
    expect(createTenant).not.toHaveBeenCalled()
  })

  it('envia os dados, sem endereço, e conclui', async () => {
    const onSuccess = vi.fn()
    render(<TenantForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Marina Souza')
    await userEvent.type(screen.getByLabelText('CPF'), VALID_CPF)
    await userEvent.type(screen.getByLabelText('E-mail'), 'marina@email.com')
    await userEvent.type(screen.getByLabelText('Celular (WhatsApp)'), '11988881111')
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar inquilino' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    const sent = createTenant.mock.calls[0][0]
    expect(sent).toMatchObject({ name: 'Marina Souza', person_type: 'PF', email: 'marina@email.com' })
    expect(sent.postal_code).toBeUndefined()
    expect(sent.address_line).toBeUndefined()
  })

  it('documento duplicado aparece junto ao campo', async () => {
    createTenant.mockResolvedValue({
      error: 'Já existe um inquilino com esse documento.',
      fieldErrors: { document: ['Já existe um inquilino com esse documento.'] },
    })
    const onSuccess = vi.fn()
    render(<TenantForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Marina Souza')
    await userEvent.type(screen.getByLabelText('CPF'), VALID_CPF)
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar inquilino' }))
    expect(await screen.findAllByText('Já existe um inquilino com esse documento.')).not.toHaveLength(0)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('Cancelar chama onCancel', async () => {
    const onCancel = vi.fn()
    render(<TenantForm onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('TenantForm · edição preserva o endereço', () => {
  const initial = {
    id: 't1',
    name: 'Marina Souza',
    person_type: 'PF' as const,
    email: 'marina@email.com',
    phone: '11988881111',
    document: VALID_CPF,
    notes: 'Prefere de manhã',
    postal_code: '69100000',
    address_line: 'Rua Quinze, 120',
    city: 'Itacoatiara',
    state: 'AM',
  }

  it('abre com os valores atuais', () => {
    render(<TenantForm initialData={initial} />)
    expect(screen.getByLabelText('Nome completo')).toHaveValue('Marina Souza')
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    expect(screen.getByLabelText('E-mail')).toHaveValue('marina@email.com')
    expect(screen.getByLabelText('Celular (WhatsApp)')).toHaveValue('(11) 98888-1111')
    expect(screen.getByLabelText('Observações')).toHaveValue('Prefere de manhã')
  })

  it('alterar só o e-mail devolve o endereço antigo ao backend', async () => {
    render(<TenantForm initialData={initial} />)
    await userEvent.clear(screen.getByLabelText('E-mail'))
    await userEvent.type(screen.getByLabelText('E-mail'), 'novo@email.com')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(updateTenant).toHaveBeenCalled())
    expect(updateTenant.mock.calls[0][0]).toBe('t1')
    expect(updateTenant.mock.calls[0][1]).toMatchObject({
      email: 'novo@email.com',
      postal_code: '69100000',
      address_line: 'Rua Quinze, 120',
      city: 'Itacoatiara',
      state: 'AM',
    })
  })

  it('inquilino sem endereço continua sem endereço', async () => {
    render(<TenantForm initialData={{ id: 't2', name: 'Carla Dias', person_type: 'PF' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateTenant).toHaveBeenCalled())
    const sent = updateTenant.mock.calls[0][1]
    expect(sent.postal_code).toBeUndefined()
    expect(sent.address_line).toBeUndefined()
  })
})
