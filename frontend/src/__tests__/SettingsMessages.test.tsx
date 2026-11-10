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
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { saveReminders } from '@/app/settings/messages/actions'
import MessagesPage from '@/app/settings/messages/page'

const goError = (code: string, status?: number, message?: string) => Object.assign(new Error(message ?? code), { code, status })

const defaults = {
  reminders: [
    { name: 'Lembrete gentil', offset_days: -3, body: 'Oi, {nome}! {valor} vence em {vencimento}.\n\n{link}' },
    { name: 'Cobrança com Pix', offset_days: 0, body: 'Hoje vence: {valor}. {link}' },
    { name: 'Aviso de atraso', offset_days: 3, body: 'Venceu em {vencimento}: {valor}. {link}' },
    { name: 'Segundo aviso, tom mais firme', offset_days: 10, body: '{nome}, atraso: {valor}. {link}' },
  ],
}

function mockApi(o: { get?: unknown; put?: (body: { reminders: unknown[] }) => unknown } = {}) {
  const { get = defaults, put } = o
  goFetch.mockImplementation(async (_path: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(init.body!)
      const out = put ? put(body) : { reminders: [...body.reminders].sort((a: { offset_days: number }, b: { offset_days: number }) => a.offset_days - b.offset_days) }
      if (out instanceof Error) throw out
      return out
    }
    if (get instanceof Error) throw get
    return get
  })
}
const renderPage = async () => render(await MessagesPage())
const putBody = () => JSON.parse(goFetch.mock.calls.find((c) => c[1]?.method === 'PUT')![1].body)
const sheet = () => screen.getByRole('dialog')

beforeEach(() => {
  goFetch.mockReset()
  revalidatePath.mockReset()
  Object.values(toast).forEach((f) => f.mockReset())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('saveReminders (action)', () => {
  const ok = [{ name: 'Único', offset_days: 0, body: 'Oi {nome}' }]

  it('valida antes de chamar a API', async () => {
    expect(await saveReminders([{ ...ok[0], body: 'Oi {nom}' }])).toEqual({ error: 'Variável desconhecida: {nom}.' })
    expect(await saveReminders([])).toEqual({ error: 'Informe de 1 a 8 lembretes.' })
    expect(goFetch).not.toHaveBeenCalled()
  })

  it('manda a lista inteira e atualiza as telas', async () => {
    goFetch.mockResolvedValue({ reminders: ok })
    expect(await saveReminders(ok)).toEqual({ success: true, reminders: ok })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/settings/reminders', { method: 'PUT', body: JSON.stringify({ reminders: ok }) })
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(['/settings/messages', '/financial/receivables'])
  })

  it('só o dono (403), mensagem do servidor e erro genérico', async () => {
    goFetch.mockRejectedValue(goError('FORBIDDEN', 403))
    expect(await saveReminders(ok)).toEqual({ error: 'Só o dono da conta pode alterar as mensagens.' })
    goFetch.mockRejectedValue(goError('INVALID_REMINDERS', 400, 'o texto vai de 1 a 1000 caracteres'))
    expect(await saveReminders(ok)).toEqual({ error: 'O texto vai de 1 a 1000 caracteres.' })
    goFetch.mockRejectedValue(new Error('boom'))
    expect(await saveReminders(ok)).toEqual({ error: 'Erro ao salvar as mensagens.' })
  })
})

describe('Página de mensagens e cobrança', () => {
  it('lista os lembretes por dias, como no canvas', async () => {
    mockApi()
    await renderPage()
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items.map((li) => li.textContent?.replace(/Editar$/, ''))).toEqual([
      '3 dias antes do vencimentoLembrete gentil',
      'No dia do vencimentoCobrança com Pix',
      '3 dias depoisAviso de atraso',
      '10 dias depoisSegundo aviso, tom mais firme',
    ])
    expect(screen.getByRole('button', { name: 'Adicionar lembrete' })).toBeEnabled()
  })

  it('falha ao carregar: mensagem e tentar de novo', async () => {
    mockApi({ get: new Error('boom') })
    await renderPage()
    expect(screen.getByText('Não foi possível carregar as mensagens.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar novamente' }).getAttribute('href')).toBe('/settings/messages')
  })

  it('editar mostra o modelo e a prévia com os dados da Marina', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Editar Lembrete gentil' }))
    expect((within(sheet()).getByLabelText('Nome') as HTMLInputElement).value).toBe('Lembrete gentil')
    expect((within(sheet()).getByLabelText('Modelo da mensagem') as HTMLTextAreaElement).value).toContain('{nome}')
    const preview = within(sheet()).getByRole('region', { name: 'Prévia' }).textContent!.replace(/ /g, ' ')
    expect(preview).toContain('Oi, Marina! R$ 1.850,00 vence em 05/11.')
    expect(within(sheet()).getByLabelText('Quando')).toHaveProperty('value', 'before')
    expect(within(sheet()).getByLabelText('Quantos dias')).toHaveProperty('value', '3')
  })

  it('tocar numa variável a insere na posição do cursor e a prévia acompanha', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Editar Cobrança com Pix' }))
    const body = within(sheet()).getByLabelText('Modelo da mensagem') as HTMLTextAreaElement
    await user.clear(body)
    await user.type(body, 'Oi !')
    body.setSelectionRange(3, 3)
    await user.click(within(sheet()).getByRole('button', { name: '{nome}' }))
    expect(body.value).toBe('Oi {nome}!')
    expect(within(sheet()).getByRole('region', { name: 'Prévia' })).toHaveTextContent('Oi Marina!')
  })

  it('variável desconhecida: mostra o erro e não envia', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Editar Aviso de atraso' }))
    const body = within(sheet()).getByLabelText('Modelo da mensagem')
    await user.clear(body)
    await user.type(body, 'Oi {{nom}')
    await user.click(within(sheet()).getByRole('button', { name: 'Salvar' }))
    expect((await within(sheet()).findByRole('alert')).textContent).toBe('Variável desconhecida: {nom}.')
    expect(goFetch.mock.calls.some((c) => c[1]?.method === 'PUT')).toBe(false)
  })

  it('salvar edição manda a lista inteira com a mudança e atualiza a lista', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Editar Aviso de atraso' }))
    await user.clear(within(sheet()).getByLabelText('Nome'))
    await user.type(within(sheet()).getByLabelText('Nome'), 'Atrasou')
    await user.click(within(sheet()).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Lembrete salvo.'))
    const names = putBody().reminders.map((r: { name: string }) => r.name)
    expect(names).toHaveLength(4)
    expect(names).toContain('Atrasou')
    expect(names).not.toContain('Aviso de atraso')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Atrasou')).toBeInTheDocument()
  })

  it('adicionar lembrete: dias depois, vira o número positivo', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Adicionar lembrete' }))
    expect(within(sheet()).getByText('Novo lembrete')).toBeInTheDocument()
    expect(within(sheet()).queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument()
    await user.type(within(sheet()).getByLabelText('Nome'), 'Última chance')
    await user.clear(within(sheet()).getByLabelText('Quantos dias'))
    await user.type(within(sheet()).getByLabelText('Quantos dias'), '20')
    await user.type(within(sheet()).getByLabelText('Modelo da mensagem'), 'Atraso de {{valor}')
    await user.click(within(sheet()).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Lembrete salvo.'))
    const added = putBody().reminders.find((r: { name: string }) => r.name === 'Última chance')
    expect(added).toEqual({ name: 'Última chance', offset_days: 20, body: 'Atraso de {valor}' })
    expect(putBody().reminders).toHaveLength(5)
  })

  it('dias repetidos: erro e nada enviado', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Adicionar lembrete' }))
    await user.type(within(sheet()).getByLabelText('Nome'), 'Repetido')
    await user.selectOptions(within(sheet()).getByLabelText('Quando'), 'same')
    await user.type(within(sheet()).getByLabelText('Modelo da mensagem'), 'x')
    await user.click(within(sheet()).getByRole('button', { name: 'Salvar' }))
    expect((await within(sheet()).findByRole('alert')).textContent).toBe('Dois lembretes não podem ter os mesmos dias (0).')
  })

  it('remover manda a lista sem o lembrete; com um só, Remover fica desabilitado', async () => {
    mockApi({ get: { reminders: [defaults.reminders[1]] } })
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Editar Cobrança com Pix' }))
    expect(within(sheet()).getByRole('button', { name: 'Remover' })).toBeDisabled()
  })

  it('remover um de vários', async () => {
    mockApi()
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Editar Aviso de atraso' }))
    await user.click(within(sheet()).getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Lembrete removido.'))
    expect(putBody().reminders.map((r: { name: string }) => r.name)).toEqual(['Lembrete gentil', 'Cobrança com Pix', 'Segundo aviso, tom mais firme'])
  })

  it('no máximo 8: Adicionar fica desabilitado', async () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({ name: `L${i}`, offset_days: i, body: 'x' }))
    mockApi({ get: { reminders: eight } })
    await renderPage()
    expect(screen.getByRole('button', { name: 'Adicionar lembrete' })).toBeDisabled()
    expect(screen.getByText(/O máximo é de 8 lembretes/)).toBeInTheDocument()
  })

  it('erro do servidor (não é o dono) aparece no painel', async () => {
    mockApi({ put: () => goError('FORBIDDEN', 403) })
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Editar Aviso de atraso' }))
    await user.click(within(sheet()).getByRole('button', { name: 'Salvar' }))
    expect(await within(sheet()).findByText('Só o dono da conta pode alterar as mensagens.')).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })
})
