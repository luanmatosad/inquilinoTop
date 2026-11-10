import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

import { MobileTabBar } from '@/components/MobileTabBar'

function renderBar(pathname = '/') {
  pathnameMock.value = pathname
  return render(<MobileTabBar user={{ name: 'Luan Matos', email: 'luan@example.com' }} />)
}

describe('MobileTabBar', () => {
  it('mostra as cinco abas do canvas, na ordem', () => {
    renderBar()
    const nav = screen.getByRole('navigation', { name: /principal/i })
    const items = Array.from(nav.querySelectorAll('a, button'))
    expect(items.map((i) => i.textContent)).toEqual([
      'Hoje',
      'Imóveis',
      'Inquilinos',
      'Receber',
      'Mais',
    ])
    expect(items.slice(0, 4).map((i) => i.getAttribute('href'))).toEqual([
      '/',
      '/properties',
      '/tenants',
      '/financial/receivables',
    ])
  })

  it('só ele é escondido em telas largas (md:hidden)', () => {
    renderBar()
    expect(screen.getByRole('navigation', { name: /principal/i })).toHaveClass('md:hidden')
  })

  it('marca Hoje como página atual em "/"', () => {
    renderBar('/')
    const current = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current.map((a) => a.textContent)).toEqual(['Hoje'])
  })

  it('subrotas ativam a aba do módulo', () => {
    renderBar('/financial/receivables/abc/receipt')
    const current = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current.map((a) => a.textContent)).toEqual(['Receber'])
  })

  it('"Mais" fica ativa em páginas que não são abas', () => {
    renderBar('/leases/123')
    expect(screen.getByRole('button', { name: 'Mais' })).toHaveAttribute('aria-current', 'page')
  })

  it('tocar em "Mais" mostra os demais itens, o usuário e Sair', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Mais' }))
    const dialog = screen.getByRole('dialog')
    const hrefs = within(dialog)
      .getAllByRole('link')
      .map((a) => [a.textContent, a.getAttribute('href')])
    expect(hrefs).toEqual([
      ['Contratos', '/leases'],
      ['Despesas', '/financial/payables'],
      ['Relatórios', '/reports'],
      ['Integrações', '/integrations'],
      ['Configurações', '/settings/profile'],
    ])
    expect(within(dialog).getByText('Luan Matos')).toBeInTheDocument()
    expect(within(dialog).getByText('luan@example.com')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })
})
