import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/ui/theme-toggle'

function setup() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Node 26 define um localStorage global que oculta o do jsdom; usamos um em memória.
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    })
    document.documentElement.className = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('troca para escuro e aplica a classe dark no <html>', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /alternar tema/i }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('lembra o tema escuro ao montar de novo', async () => {
    const first = setup()
    await userEvent.click(screen.getByRole('button', { name: /alternar tema/i }))
    first.unmount()
    document.documentElement.className = ''

    setup()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
