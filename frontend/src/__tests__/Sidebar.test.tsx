import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { Sidebar } from '@/components/Sidebar'

describe('Sidebar', () => {
  it('renders settings links', () => {
    render(<Sidebar />)
    expect(screen.getByText('Meu Perfil')).toBeInTheDocument()
    expect(screen.getByText('Config. Financeira')).toBeInTheDocument()
  })

  it('renders notifications settings link', () => {
    render(<Sidebar />)
    expect(screen.getByText('Notificações')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Notificações/i })).toHaveAttribute('href', '/owner/settings')
  })
})
