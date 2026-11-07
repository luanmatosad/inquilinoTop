import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect }))

import NewPropertyPage from '@/app/properties/new/page'

beforeEach(() => redirect.mockReset())

describe('rotas antigas de imóveis', () => {
  it('/properties/new redireciona para a lista com o painel aberto', () => {
    NewPropertyPage()
    expect(redirect).toHaveBeenCalledWith('/properties?novo=1')
  })
})

import EditPropertyPage from '@/app/properties/[id]/edit/page'

describe('/properties/[id]/edit', () => {
  it('redireciona para a aba Informações do detalhe', async () => {
    await EditPropertyPage({ params: Promise.resolve({ id: 'p1' }) })
    expect(redirect).toHaveBeenCalledWith('/properties/p1?aba=informacoes')
  })
})
