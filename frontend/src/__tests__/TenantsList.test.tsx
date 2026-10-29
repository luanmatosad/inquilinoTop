import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const listTenants = vi.fn()
vi.mock('@/data/owner/tenants-dal', () => ({
  listTenants: () => listTenants(),
}))

import { TenantsList } from '@/components/owner/TenantsList'

const tenant = {
  id: 't1',
  owner_id: 'o1',
  name: 'Maria Silva',
  email: 'maria@example.com',
  phone: null,
  document: null,
  person_type: 'PF' as const,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

async function renderList() {
  render(await TenantsList())
}

describe('TenantsList', () => {
  beforeEach(() => {
    listTenants.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('mostra estado vazio quando API retorna 0 inquilinos', async () => {
    listTenants.mockResolvedValue([])
    await renderList()
    expect(screen.getByText('Nenhum inquilino encontrado.')).toBeInTheDocument()
    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument()
  })

  it('mostra erro, não o estado vazio, quando a API falha', async () => {
    listTenants.mockRejectedValue(new Error('network'))
    await renderList()
    expect(
      screen.getByText('Não foi possível carregar os inquilinos. Tente novamente.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Nenhum inquilino encontrado.')).not.toBeInTheDocument()
  })

  it('oferece link "Tentar novamente" que recarrega a rota', async () => {
    listTenants.mockRejectedValue(new Error('network'))
    await renderList()
    expect(screen.getByRole('link', { name: 'Tentar novamente' })).toHaveAttribute(
      'href',
      '/owner/tenants',
    )
  })

  it('renderiza a lista quando há inquilinos', async () => {
    listTenants.mockResolvedValue([tenant])
    await renderList()
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument()
  })
})
