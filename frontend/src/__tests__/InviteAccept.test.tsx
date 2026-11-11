import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

const cookieJar = vi.hoisted(() => ({ values: {} as Record<string, string> }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => (n in cookieJar.values ? { value: cookieJar.values[n] } : undefined),
  }),
}))

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const acceptInviteAction = vi.hoisted(() => vi.fn())
vi.mock('@/app/invite/accept/actions', () => ({ acceptInviteAction }))

import InviteAcceptPage from '@/app/invite/accept/page'

const renderPage = async (token?: string) => {
  const el = await InviteAcceptPage({ searchParams: Promise.resolve({ token }) })
  return render(<>{el}</>)
}

beforeEach(() => {
  cookieJar.values = { access_token: 'a', refresh_token: 'r' }
  acceptInviteAction.mockReset()
  router.replace.mockReset()
  router.refresh.mockReset()
})

describe('aceite de convite', () => {
  it('sem token não aceita nada e informa o link inválido', async () => {
    await renderPage(undefined)
    expect(screen.getByText(/token não foi informado/)).toBeTruthy()
    expect(acceptInviteAction).not.toHaveBeenCalled()
  })

  it('sem sessão leva ao login preservando o retorno para o convite', async () => {
    cookieJar.values = {}
    await renderPage('abc123')
    const link = screen.getByRole('link', { name: 'Entrar para aceitar' })
    expect(link.getAttribute('href')).toBe(
      `/login?next=${encodeURIComponent('/invite/accept?token=abc123')}`,
    )
    expect(acceptInviteAction).not.toHaveBeenCalled()
  })

  it('aceita com sucesso e volta ao painel com a sessão atualizada', async () => {
    acceptInviteAction.mockResolvedValue({ ok: true })
    await renderPage('abc123')
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
    expect(acceptInviteAction).toHaveBeenCalledWith('abc123')
    expect(router.refresh).toHaveBeenCalled()
  })

  it('usuário que já tem organização vê a mensagem fixa e fica na página', async () => {
    acceptInviteAction.mockResolvedValue({
      ok: false,
      code: 'ALREADY_HAS_ORG',
      message: 'Você já participa de uma organização.',
    })
    await renderPage('abc123')
    expect(await screen.findByText('Você já participa de uma organização.')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('convite inválido ou expirado mostra a mensagem do backend', async () => {
    acceptInviteAction.mockResolvedValue({ ok: false, code: 'INVITE_EXPIRED', message: 'convite expirado' })
    await renderPage('abc123')
    expect(await screen.findByText('convite expirado')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalled()
  })
})
