import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ComingSoon } from '@/components/ComingSoon'
import IntegrationsPage from '@/app/integrations/page'

describe('ComingSoon', () => {
  it('mostra título e aviso de "em breve"', () => {
    render(<ComingSoon title="Algo" description="Descrição do módulo." />)
    expect(screen.getByRole('heading', { name: 'Algo' })).toBeInTheDocument()
    expect(screen.getByText('Descrição do módulo.')).toBeInTheDocument()
    expect(screen.getByText(/em breve/i)).toBeInTheDocument()
  })
})

describe.each([
  ['Integrações', IntegrationsPage],
])('página %s', (title, Page) => {
  it('é um placeholder: título, aviso e nenhuma chamada à API', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render(<Page />)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText(/em breve/i)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
