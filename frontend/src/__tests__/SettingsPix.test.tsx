import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { savePix, saveUnitPix, removeUnitPix } from '@/app/settings/pix/actions'
import PixSettingsPage from '@/app/settings/pix/page'
import FinancialSettingsRedirect from '@/app/settings/financial/page'

const goError = (code: string, status?: number) => Object.assign(new Error(code), { code, status })

const properties = [
  { id: 'p1', name: 'Ed. Aurora', units: [{ id: 'u1', label: 'Ap 302' }] },
  { id: 'p3', name: 'Centro Empresarial', units: [{ id: 'u3', label: 'Sala 3' }] },
]
const configured = {
  default: { configured: true, key_type: 'CPF', key: '52998224725', receiver_name: 'Luan Matos', city: 'Manaus' },
  units: [{ unit_id: 'u3', key_type: 'CNPJ', key: '11222333000181', receiver_name: 'Centro Empresarial Ltda', confirmed_at: '2026-11-10T12:00:00Z' }],
}

function mockApi(o: { pix?: unknown; properties?: unknown; legacy?: unknown } = {}) {
  const { pix = configured, properties: ps = properties, legacy = { pix_key: null } } = o
  goFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (init?.method && init.method !== 'GET') return {}
    const v = path === '/api/v1/settings/pix' ? pix : path === '/api/v1/properties' ? ps : path === '/api/v1/payments/config' ? legacy : undefined
    if (v === undefined) throw new Error('rota inesperada ' + path)
    if (v instanceof Error) throw v
    return v
  })
}
const renderPage = async () => render(await PixSettingsPage())
const putCall = (path: string) => goFetch.mock.calls.find((c) => c[0] === path && c[1]?.method === 'PUT')

beforeEach(() => {
  goFetch.mockReset()
  revalidatePath.mockReset()
  redirect.mockReset()
  Object.values(toast).forEach((f) => f.mockReset())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('actions do Pix', () => {
  const input = { key_type: 'CPF', key: '529.982.247-25', receiver_name: ' Luan Matos ', city: ' Manaus ' }

  it('savePix: valida antes de chamar a API', async () => {
    const res = await savePix({ ...input, key: '123' })
    expect(res).toMatchObject({ error: 'Confira os campos.', fieldErrors: { key: expect.stringMatching(/CPF/) } })
    expect(goFetch).not.toHaveBeenCalled()
  })

  it('savePix: manda a chave normalizada e atualiza as telas', async () => {
    goFetch.mockResolvedValue({})
    expect(await savePix(input)).toEqual({ success: true })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/settings/pix', { method: 'PUT', body: JSON.stringify({ key_type: 'CPF', key: '52998224725', receiver_name: 'Luan Matos', city: 'Manaus' }) })
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(['/settings/pix', '/', '/financial/receivables'])
  })

  it('savePix: só o dono (403) e códigos do servidor', async () => {
    goFetch.mockRejectedValue(goError('FORBIDDEN', 403))
    expect(await savePix(input)).toEqual({ error: 'Só o dono da conta pode alterar o Pix.' })
    goFetch.mockRejectedValue(goError('INVALID_PIX_KEY', 400))
    expect(await savePix(input)).toEqual({ error: 'A chave não é válida para o tipo escolhido.' })
    goFetch.mockRejectedValue(new Error('boom'))
    expect(await savePix(input)).toEqual({ error: 'Erro ao salvar o Pix.' })
  })

  const unitInput = { key_type: 'CNPJ', key: '11.222.333/0001-81', receiver_name: 'Centro Empresarial Ltda' }

  it('saveUnitPix: sem confirmação nem chama a API', async () => {
    expect(await saveUnitPix('u3', unitInput, false)).toEqual({ error: 'Confirme que o titular da chave autorizou receber os pagamentos desta unidade.' })
    expect(goFetch).not.toHaveBeenCalled()
  })

  it('saveUnitPix: manda confirmed=true e a chave normalizada, sem cidade', async () => {
    goFetch.mockResolvedValue({})
    expect(await saveUnitPix('u3', unitInput, true)).toEqual({ success: true })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/settings/pix/units/u3', {
      method: 'PUT',
      body: JSON.stringify({ key_type: 'CNPJ', key: '11222333000181', receiver_name: 'Centro Empresarial Ltda', confirmed: true }),
    })
  })

  it('saveUnitPix: chave inválida e unidade inexistente', async () => {
    expect(await saveUnitPix('u3', { ...unitInput, key: '123' }, true)).toMatchObject({ fieldErrors: { key: expect.any(String) } })
    goFetch.mockRejectedValue(goError('NOT_FOUND', 404))
    expect(await saveUnitPix('u3', unitInput, true)).toEqual({ error: 'Unidade não encontrada.' })
  })

  it('removeUnitPix: DELETE na unidade', async () => {
    goFetch.mockResolvedValue({})
    expect(await removeUnitPix('u3')).toEqual({ success: true })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/settings/pix/units/u3', { method: 'DELETE' })
  })
})

describe('/settings/financial (endereço antigo)', () => {
  it('redireciona para /settings/pix', () => {
    FinancialSettingsRedirect()
    expect(redirect).toHaveBeenCalledWith('/settings/pix')
  })
})

describe('Página de Recebimento (Pix)', () => {
  it('chave padrão, textos do canvas e a tabela por unidade com chaves mascaradas', async () => {
    mockApi()
    await renderPage()
    expect((screen.getByLabelText('Tipo de chave') as HTMLSelectElement).value).toBe('CPF')
    expect(screen.getByLabelText('Chave Pix')).toHaveProperty('value', '52998224725')
    expect(screen.getByLabelText('Nome de quem recebe')).toHaveProperty('value', 'Luan Matos')
    expect(screen.getByLabelText('Cidade')).toHaveProperty('value', 'Manaus')
    expect(screen.getByText(/Aparece para o inquilino na hora de pagar/)).toBeInTheDocument()
    expect(screen.queryByText(/Esta é a chave que você já usava/)).not.toBeInTheDocument()

    const list = screen.getByRole('list')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Ap 302 · Ed. Aurora')).toBeInTheDocument()
    expect(within(rows[0]).getByText('CPF ···.247-25')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Chave padrão')).toBeInTheDocument()
    expect(within(rows[0]).getByRole('button', { name: /Usar outra chave/ })).toBeInTheDocument()
    expect(within(rows[1]).getByText('CNPJ 11.222.333/0001-81')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Outra chave')).toBeInTheDocument()
    expect(within(rows[1]).getByRole('button', { name: /Editar/ })).toBeInTheDocument()
    expect(screen.getByText(/não guarda nem repassa seu dinheiro/)).toBeInTheDocument()
  })

  it('chave antiga sugerida enquanto nada foi salvo na tela nova', async () => {
    mockApi({ pix: { default: { configured: false }, units: [] }, legacy: { pix_key: '529.982.247-25' } })
    await renderPage()
    expect(screen.getByText(/Esta é a chave que você já usava/)).toBeInTheDocument()
    expect((screen.getByLabelText('Tipo de chave') as HTMLSelectElement).value).toBe('CPF')
    expect(screen.getByLabelText('Chave Pix')).toHaveProperty('value', '529.982.247-25')
    expect(screen.getAllByText('Chave padrão não definida')).toHaveLength(2)
  })

  it('imóveis indisponíveis: avisa e o formulário da chave padrão continua', async () => {
    mockApi({ properties: new Error('boom') })
    await renderPage()
    expect(screen.getByText(/Imóveis indisponíveis no momento/)).toBeInTheDocument()
    expect(screen.getByLabelText('Chave Pix')).toBeInTheDocument()
  })

  it('Pix indisponível: mensagem e tentar de novo', async () => {
    mockApi({ pix: new Error('boom') })
    await renderPage()
    expect(screen.getByText('Não foi possível carregar o Pix.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar novamente' }).getAttribute('href')).toBe('/settings/pix')
  })

  it('chave padrão inválida: mostra o erro e não envia', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.clear(screen.getByLabelText('Chave Pix'))
    await user.type(screen.getByLabelText('Chave Pix'), '123')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/CPF inválido/)
    expect(putCall('/api/v1/settings/pix')).toBeUndefined()
  })

  it('salva a chave padrão', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.selectOptions(screen.getByLabelText('Tipo de chave'), 'EMAIL')
    await user.clear(screen.getByLabelText('Chave Pix'))
    await user.type(screen.getByLabelText('Chave Pix'), 'Voce@Email.com')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pix salvo.'))
    expect(JSON.parse(putCall('/api/v1/settings/pix')![1].body)).toMatchObject({ key_type: 'EMAIL', key: 'voce@email.com' })
  })
})

describe('Painel da chave por unidade', () => {
  const sheet = () => screen.getByRole('dialog')

  it('exige a confirmação para salvar e envia confirmed=true', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: /Usar outra chave em Ap 302/ }))
    expect(within(sheet()).getByText('Chave Pix do imóvel')).toBeInTheDocument()
    expect(within(sheet()).getByText(/Os pagamentos desse imóvel vão para outra conta, não para a sua/)).toBeInTheDocument()
    expect(within(sheet()).queryByRole('button', { name: 'Usar chave padrão' })).not.toBeInTheDocument()

    await user.selectOptions(within(sheet()).getByLabelText('Tipo de chave'), 'EMAIL')
    await user.type(within(sheet()).getByLabelText('Chave Pix'), 'socio@email.com')
    await user.type(within(sheet()).getByLabelText('Nome de quem recebe'), 'Sócio Ltda')
    const save = within(sheet()).getByRole('button', { name: 'Salvar' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    await user.click(within(sheet()).getByLabelText(/Confirmo que o titular dessa chave autorizou/))
    expect(save.disabled).toBe(false)
    await user.click(save)

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Chave da unidade salva.'))
    expect(JSON.parse(putCall('/api/v1/settings/pix/units/u1')![1].body)).toEqual({ key_type: 'EMAIL', key: 'socio@email.com', receiver_name: 'Sócio Ltda', confirmed: true })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('chave inválida aparece no painel e nada é enviado', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: /Usar outra chave em Ap 302/ }))
    await user.selectOptions(within(sheet()).getByLabelText('Tipo de chave'), 'CPF')
    await user.type(within(sheet()).getByLabelText('Chave Pix'), '111')
    await user.click(within(sheet()).getByLabelText(/Confirmo que o titular/))
    await user.click(within(sheet()).getByRole('button', { name: 'Salvar' }))
    expect((await within(sheet()).findAllByRole('alert'))[0].textContent).toMatch(/CPF inválido/)
    expect(putCall('/api/v1/settings/pix/units/u1')).toBeUndefined()
  })

  it('editar mostra a conta atual e oferece "Usar chave padrão"', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: /Editar Sala 3/ }))
    expect(within(sheet()).getByLabelText('Chave Pix')).toHaveProperty('value', '11222333000181')
    expect(within(sheet()).getByLabelText('Nome de quem recebe')).toHaveProperty('value', 'Centro Empresarial Ltda')
    await user.click(within(sheet()).getByRole('button', { name: 'Usar chave padrão' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('A unidade voltou a usar a chave padrão.'))
    expect(goFetch).toHaveBeenCalledWith('/api/v1/settings/pix/units/u3', { method: 'DELETE' })
  })

  it('erro do servidor (não é o dono) aparece no painel', async () => {
    mockApi()
    goFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === 'PUT') throw goError('FORBIDDEN', 403)
      if (init?.method) return {}
      return path === '/api/v1/settings/pix' ? configured : path === '/api/v1/properties' ? properties : { pix_key: null }
    })
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: /Usar outra chave em Ap 302/ }))
    await user.selectOptions(within(sheet()).getByLabelText('Tipo de chave'), 'EMAIL')
    await user.type(within(sheet()).getByLabelText('Chave Pix'), 'socio@email.com')
    await user.click(within(sheet()).getByLabelText(/Confirmo que o titular/))
    await user.click(within(sheet()).getByRole('button', { name: 'Salvar' }))
    expect((await within(sheet()).findByText('Só o dono da conta pode alterar o Pix.'))).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })
})
