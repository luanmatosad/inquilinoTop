import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Os pacotes de fonte do next/font viram só a classe da variável CSS.
vi.mock('next/font/local', () => {
  let n = 0
  return { default: () => ({ variable: `font-var-${++n}`, className: 'unused' }) }
})
vi.mock('@/components/Header', () => ({ default: () => null }))
vi.mock('@/components/AppSidebar', () => ({ default: () => null }))
vi.mock('@/components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/theme-provider', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/components/OrganizationScope', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/app/globals.css', () => ({}))

import RootLayout from '@/app/layout'

function tags() {
  const html = renderToStaticMarkup(<RootLayout>conteúdo</RootLayout>)
  return {
    html: html.match(/<html[^>]*>/)?.[0] ?? '',
    body: html.match(/<body[^>]*>/)?.[0] ?? '',
  }
}

describe('layout raiz: fontes do canvas', () => {
  it('as variáveis de fonte ficam no <html>, onde o Tailwind resolve o font-family padrão', () => {
    const { html } = tags()
    expect(html).toContain('font-var-1')
    expect(html).toContain('font-var-2')
  })

  it('o <body> não repete as variáveis e usa font-sans', () => {
    const { body } = tags()
    expect(body).not.toContain('font-var-')
    expect(body).toMatch(/class="[^"]*\bfont-sans\b/)
  })
})
