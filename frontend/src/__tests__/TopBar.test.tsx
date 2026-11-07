import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('@/components/ui/theme-toggle', () => ({ ThemeToggle: () => <button>tema</button> }))

import { TopBar } from '@/components/TopBar'
import { SidebarProvider } from '@/components/ui/sidebar'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= () => {}
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const renderBar = () =>
  render(
    <SidebarProvider>
      <TopBar />
    </SidebarProvider>,
  )

function setPlatform(platform: string) {
  vi.stubGlobal('navigator', { ...navigator, platform, userAgent: platform })
}

describe('TopBar', () => {
  it('renderiza ações principais com nomes acessíveis', () => {
    setPlatform('MacIntel')
    renderBar()
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pesquisar no sistema' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute('href', '/owner/settings')
    expect(screen.getByRole('link', { name: 'Ajuda e suporte' })).toHaveAttribute('href', '/support')
  })

  it('não tem atalho global "Novo imóvel": o cadastro começa na página de Imóveis', () => {
    setPlatform('MacIntel')
    renderBar()
    expect(screen.queryByRole('link', { name: 'Novo imóvel' })).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/properties/new"]')).toBeNull()
  })

  it('botão de menu tem um único ícone (sem filho duplicado)', () => {
    setPlatform('MacIntel')
    renderBar()
    expect(screen.getByRole('button', { name: 'Abrir menu' }).querySelectorAll('svg')).toHaveLength(1)
  })

  it('mostra ⌘K no Mac', () => {
    setPlatform('MacIntel')
    renderBar()
    expect(screen.getByText('⌘K')).toBeInTheDocument()
  })

  it('mostra Ctrl K no Windows/Linux', () => {
    setPlatform('Win32')
    renderBar()
    expect(screen.getByText('Ctrl K')).toBeInTheDocument()
    expect(screen.queryByText('⌘K')).not.toBeInTheDocument()
  })

  it('clicar em pesquisar abre a paleta', () => {
    setPlatform('MacIntel')
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Pesquisar no sistema' }))
    expect(screen.getByPlaceholderText('Ir para...')).toBeInTheDocument()
  })
})
