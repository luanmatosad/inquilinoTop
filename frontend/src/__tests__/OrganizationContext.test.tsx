import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { OrganizationProvider, useOrganization } from '@/contexts/OrganizationContext'
import type { MyMembership } from '@/lib/go/organization'

function Probe() {
  const org = useOrganization()
  if (!org) return <p>sem organização</p>
  return (
    <div>
      <p>{org.organization.name}</p>
      <p>papel: {org.role}</p>
      <p>filial: {org.branchId ?? 'nenhuma'}</p>
      <p>{org.can('property:write') ? 'pode escrever imóveis' : 'só leitura de imóveis'}</p>
    </div>
  )
}

const employee: MyMembership = {
  organization: { id: 'org-1', name: 'Administradora X', plan: 'free' },
  role: 'employee',
  permissions: ['property:read', 'org:read'],
}

describe('useOrganization', () => {
  it('retorna null fora do provider', () => {
    render(<Probe />)
    expect(screen.getByText('sem organização')).toBeInTheDocument()
  })

  it('retorna null quando o usuário não tem organização', () => {
    render(
      <OrganizationProvider membership={null}>
        <Probe />
      </OrganizationProvider>,
    )
    expect(screen.getByText('sem organização')).toBeInTheDocument()
  })

  it('expõe organização, papel e permissões do membership', () => {
    render(
      <OrganizationProvider membership={employee}>
        <Probe />
      </OrganizationProvider>,
    )
    expect(screen.getByText('Administradora X')).toBeInTheDocument()
    expect(screen.getByText('papel: employee')).toBeInTheDocument()
    expect(screen.getByText('filial: nenhuma')).toBeInTheDocument()
    expect(screen.getByText('só leitura de imóveis')).toBeInTheDocument()
  })

  it('expõe a filial e permite escrita quando o papel tem a permissão', () => {
    render(
      <OrganizationProvider
        membership={{
          ...employee,
          role: 'manager',
          branch_id: 'branch-9',
          permissions: ['property:read', 'property:write'],
        }}
      >
        <Probe />
      </OrganizationProvider>,
    )
    expect(screen.getByText('filial: branch-9')).toBeInTheDocument()
    expect(screen.getByText('pode escrever imóveis')).toBeInTheDocument()
  })
})
