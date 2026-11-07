import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const pathnameMock = vi.hoisted(() => ({ value: '/' }))
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock.value,
  useRouter: () => ({ push: vi.fn() }),
}))

import { AppShell } from '@/components/AppShell'

describe('AppShell', () => {
  it('rota pública: só children, sem header nem sidebar', () => {
    pathnameMock.value = '/login'
    render(
      <AppShell sidebar={<nav>side</nav>} header={<header>head</header>}>
        <p>conteudo</p>
      </AppShell>,
    )
    expect(screen.getByText('conteudo')).toBeInTheDocument()
    expect(screen.queryByText('head')).not.toBeInTheDocument()
    expect(screen.queryByText('side')).not.toBeInTheDocument()
  })

  it('não tem modo visitante: sem sidebar ainda é o shell, nunca um cabeçalho solto', () => {
    pathnameMock.value = '/'
    render(
      <AppShell sidebar={null} header={<header>head</header>}>
        <p>conteudo</p>
      </AppShell>,
    )
    // O middleware redireciona quem não tem sessão; o shell não desenha um estado próprio para isso.
    const main = screen.getByRole('main')
    expect(main).toContainElement(screen.getByText('head'))
    expect(main).toContainElement(screen.getByText('conteudo'))
  })

  it('com sessão: sidebar, header e children', () => {
    pathnameMock.value = '/properties'
    render(
      <AppShell sidebar={<nav>side</nav>} header={<header>head</header>}>
        <p>conteudo</p>
      </AppShell>,
    )
    expect(screen.getByText('side')).toBeInTheDocument()
    expect(screen.getByText('head')).toBeInTheDocument()
    expect(screen.getByText('conteudo')).toBeInTheDocument()
  })
})
