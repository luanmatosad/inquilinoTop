import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

const pathnameMock = vi.hoisted(() => ({ value: '/' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock.value,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/app/auth/actions', () => ({
  logout: vi.fn(),
}))

import { Sidebar, getInitials, FALLBACK_ORGANIZATION_NAME } from '@/components/Sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

function renderSidebar(
  pathname: string,
  props: Partial<React.ComponentProps<typeof Sidebar>> = {},
) {
  pathnameMock.value = pathname
  return render(
    <SidebarProvider open onOpenChange={() => {}}>
      <Sidebar
        organization={{ name: 'Vela Imóveis', plan: 'enterprise' }}
        user={{ name: 'Luan Matos', email: 'luan@example.com' }}
        {...props}
      />
    </SidebarProvider>,
  )
}

describe('Sidebar', () => {
  it('mostra os grupos e links do canvas, sem Laudos, Importar nem Suporte', () => {
    renderSidebar('/')
    for (const group of ['Gestão', 'Financeiro', 'Administrativo']) {
      expect(screen.getByText(group)).toBeInTheDocument()
    }
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([
      '/',
      '/properties',
      '/tenants',
      '/leases',
      '/financial/receivables',
      '/financial/payables',
      '/reports',
      '/integrations',
      '/settings/profile',
    ])
    expect(screen.getByText('Integrações')).toBeInTheDocument()
    for (const label of ['Laudos', 'Importar', 'Suporte']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    expect(screen.queryByText(/Novo Imóvel/i)).not.toBeInTheDocument()
  })

  it('marca só Hoje como página atual em "/"', () => {
    renderSidebar('/')
    const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', '/')
  })

  it('Recebimentos não ativa Hoje', () => {
    renderSidebar('/financial/receivables')
    const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current.map((a) => a.getAttribute('href'))).toEqual(['/financial/receivables'])
  })

  it.each(['/settings', '/settings/profile', '/settings/team', '/settings/security', '/owner/settings'])(
    '%s destaca Configurações',
    (path) => {
      renderSidebar(path)
      const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')
      expect(current.map((a) => a.getAttribute('href'))).toEqual(['/settings/profile'])
    },
  )

  it('exibe a organização atual sem controle de troca', () => {
    renderSidebar('/')
    const org = document.querySelector('[data-slot="organization"]') as HTMLElement
    expect(within(org).getByText('Vela Imóveis')).toBeInTheDocument()
    expect(within(org).getByText('Enterprise')).toBeInTheDocument()
    expect(within(org).queryByRole('button')).not.toBeInTheDocument()
  })

  it('usa texto neutro quando não há organização', () => {
    renderSidebar('/', { organization: null })
    expect(screen.getByText(FALLBACK_ORGANIZATION_NAME)).toBeInTheDocument()
  })

  it('rodapé mostra nome e e-mail do usuário no gatilho do menu', () => {
    renderSidebar('/')
    const trigger = screen.getByRole('button', { name: 'Menu do usuário' })
    expect(within(trigger).getByText('Luan Matos')).toBeInTheDocument()
    expect(within(trigger).getByText('luan@example.com')).toBeInTheDocument()
  })
})

describe('getInitials', () => {
  it('usa primeira e última palavra', () => {
    expect(getInitials('Luan Matos')).toBe('LM')
    expect(getInitials('Vela Imóveis Ltda')).toBe('VL')
  })

  it('usa duas letras de nome único e remove domínio de e-mail', () => {
    expect(getInitials('Vela')).toBe('VE')
    expect(getInitials('luan.matos@example.com')).toBe('LM')
  })

  it('retorna ? para vazio', () => {
    expect(getInitials('')).toBe('?')
  })
})
