import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

import { saveFinancialRules } from '@/app/settings/rules/actions'
import FinancialRulesPage from '@/app/settings/rules/page'

const rules = { late_fee_percent: 2.5, monthly_interest_percent: 1, default_adjustment_index: 'IPCA', readjust_notice_days: 45 }
const input = { late_fee_percent: '2,5', monthly_interest_percent: '1', default_adjustment_index: 'IPCA', readjust_notice_days: '45' }
const goError = (code: string, status?: number) => Object.assign(new Error(code), { code, status })

beforeEach(() => {
  goFetch.mockReset()
  revalidatePath.mockReset()
  Object.values(toast).forEach((f) => f.mockReset())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('saveFinancialRules (action)', () => {
  it('valores inválidos nem chamam a API e devolvem o erro por campo', async () => {
    const res = await saveFinancialRules({ ...input, late_fee_percent: '15' })
    expect(res).toEqual({ error: 'Confira os campos.', fieldErrors: { late_fee_percent: 'A multa vai de 0 a 10%.' } })
    expect(goFetch).not.toHaveBeenCalled()
  })

  it('manda números (não texto) e atualiza as telas que usam as regras', async () => {
    goFetch.mockResolvedValue(rules)
    expect(await saveFinancialRules(input)).toEqual({ success: true, rules })
    expect(goFetch).toHaveBeenCalledWith('/api/v1/settings/financial-rules', { method: 'PUT', body: JSON.stringify(rules) })
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(['/settings/rules', '/leases', '/'])
  })

  it('quem não é dono recebe uma mensagem clara (403)', async () => {
    goFetch.mockRejectedValue(goError('FORBIDDEN', 403))
    expect(await saveFinancialRules(input)).toEqual({ error: 'Só o dono da conta pode alterar as regras financeiras.' })
  })

  it('INVALID_RULES do servidor e erro genérico', async () => {
    goFetch.mockRejectedValue(goError('INVALID_RULES', 400))
    expect(((await saveFinancialRules(input)) as { error: string }).error).toMatch(/multa de 0 a 10/i)
    goFetch.mockRejectedValue(new Error('boom'))
    expect(await saveFinancialRules(input)).toEqual({ error: 'Erro ao salvar as regras.' })
  })
})

describe('Página de regras financeiras', () => {
  const renderPage = async () => render(await FinancialRulesPage())

  it('mostra os valores gravados (vírgula) e os avisos do canvas', async () => {
    goFetch.mockResolvedValue(rules)
    await renderPage()
    expect(goFetch).toHaveBeenCalledWith('/api/v1/settings/financial-rules', {})
    expect(screen.getByText('Valem para novos contratos. Dá para mudar em cada contrato.')).toBeTruthy()
    expect(screen.getByLabelText('Multa por atraso (%)')).toHaveProperty('value', '2,5')
    expect(screen.getByLabelText('Juros ao mês (%)')).toHaveProperty('value', '1')
    expect((screen.getByLabelText('Índice de reajuste padrão') as HTMLSelectElement).value).toBe('IPCA')
    expect(screen.getByLabelText(/Avisar quando faltar/)).toHaveProperty('value', '45')
    expect(screen.getByText('O aviso aparece em Hoje.')).toBeTruthy()
    expect(screen.queryByText(/carência/i)).toBeNull()
  })

  it('regras indisponíveis: mensagem e tentar de novo', async () => {
    goFetch.mockRejectedValue(new Error('boom'))
    await renderPage()
    expect(screen.getByText('Não foi possível carregar as regras financeiras.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tentar novamente' }).getAttribute('href')).toBe('/settings/rules')
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
  })

  it('valor inválido: mostra o erro e não envia', async () => {
    goFetch.mockResolvedValue(rules)
    const user = userEvent.setup()
    await renderPage()
    await user.clear(screen.getByLabelText('Juros ao mês (%)'))
    await user.type(screen.getByLabelText('Juros ao mês (%)'), '8')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Os juros vão de 0 a 5% ao mês.')
    expect(goFetch).toHaveBeenCalledTimes(1) // só o carregamento da página
  })

  it('salva e avisa', async () => {
    goFetch.mockImplementation(async (_path: string, init?: { method?: string }) => (init?.method === 'PUT' ? rules : rules))
    const user = userEvent.setup()
    await renderPage()
    await user.clear(screen.getByLabelText('Multa por atraso (%)'))
    await user.type(screen.getByLabelText('Multa por atraso (%)'), '3')
    await user.selectOptions(screen.getByLabelText('Índice de reajuste padrão'), 'IGP-M')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Regras salvas.'))
    const put = goFetch.mock.calls.find((c) => c[1]?.method === 'PUT')!
    expect(JSON.parse(put[1].body)).toEqual({ late_fee_percent: 3, monthly_interest_percent: 1, default_adjustment_index: 'IGP-M', readjust_notice_days: 45 })
  })

  it('erro do servidor (não é o dono) aparece no formulário', async () => {
    goFetch.mockImplementation(async (_p: string, init?: { method?: string }) => {
      if (init?.method === 'PUT') throw goError('FORBIDDEN', 403)
      return rules
    })
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Só o dono da conta pode alterar as regras financeiras.')
    expect(toast.success).not.toHaveBeenCalled()
  })
})
