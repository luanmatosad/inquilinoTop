import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

const pathname = vi.hoisted(() => ({ value: '/settings/security' }))
const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value, redirect }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { SettingsNav } from '@/components/settings/SettingsNav'
import SettingsIndexPage from '@/app/settings/page'
import SettingsLayout from '@/app/settings/layout'
import OwnerSettingsRedirect from '@/app/owner/settings/page'

beforeEach(() => {
  pathname.value = '/settings/security'
  redirect.mockReset()
})

describe('SettingsNav', () => {
  it('destaca a seção aberta e mostra "Em breve" nas sem tela', () => {
    render(<SettingsNav />)
    const nav = screen.getByRole('navigation', { name: 'Seções de Configurações' })
    const current = within(nav).getByRole('link', { current: 'page' })
    expect(current.textContent).toBe('Segurança')
    expect(within(nav).getByRole('link', { name: 'Recebimento (Pix)' }).getAttribute('href')).toBe('/settings/financial')
    const soon = within(nav).getByText('Regras financeiras')
    expect(soon.closest('[aria-disabled="true"]')).toBeTruthy()
    expect(within(nav).queryByRole('link', { name: /Regras financeiras/ })).toBeNull()
    expect(within(nav).getAllByText('Em breve')).toHaveLength(6)
  })

  it('no celular, as subpáginas têm o voltar para a lista', () => {
    render(<SettingsNav />)
    expect(screen.getByRole('link', { name: 'Configurações' }).getAttribute('href')).toBe('/settings')
  })

  it('na lista (/settings) não há voltar', () => {
    pathname.value = '/settings'
    render(<SettingsNav />)
    expect(screen.queryByRole('link', { name: 'Configurações' })).toBeNull()
  })
})

describe('Lista de seções (/settings)', () => {
  it('mostra as 11 seções: com tela viram link, as demais "Em breve"', () => {
    render(<SettingsIndexPage />)
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(11)
    expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/settings/profile',
      '/settings/team',
      '/settings/financial',
      '/settings/notifications',
      '/settings/security',
    ])
    expect(within(list).getAllByText('Em breve')).toHaveLength(6)
  })
})

describe('Layout e endereço antigo', () => {
  it('o layout mostra o título e o conteúdo da seção', () => {
    render(<SettingsLayout><p>conteúdo da seção</p></SettingsLayout>)
    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeTruthy()
    expect(screen.getByText('conteúdo da seção')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Seções de Configurações' })).toBeTruthy()
  })

  it('/owner/settings redireciona para as notificações', () => {
    OwnerSettingsRedirect()
    expect(redirect).toHaveBeenCalledWith('/settings/notifications')
  })
})
