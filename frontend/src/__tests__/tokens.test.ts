import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Valores de project/ds/imoviflow/tokens.json do canvas "ImoviFlow — Telas".
const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8')

function block(selector: RegExp): string {
  const m = css.match(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`))
  if (!m) throw new Error(`bloco não encontrado: ${selector}`)
  return m[1]
}

function token(body: string, name: string): string | undefined {
  return body.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()
}

const light = {
  background: '#ffffff',
  primary: '#4f46e5',
  accent: '#e0e7ff',
  secondary: '#eef0f9',
  success: '#16a34a',
  warning: '#d97706',
}

const dark = {
  background: '#18181b',
  primary: '#4f46e5',
  accent: '#312e81',
  secondary: '#1e1f3a',
  success: '#15803d',
  warning: '#b45309',
}

describe('globals.css · tokens do canvas', () => {
  it.each(Object.entries(light))('tema claro: --%s', (name, value) => {
    expect(token(block(/:root,\s*\[data-theme="light"\]/), name)).toBe(value)
  })

  it.each(Object.entries(dark))('tema escuro: --%s', (name, value) => {
    expect(token(block(/\.dark,\s*\[data-theme="dark"\]/), name)).toBe(value)
  })

  it('expõe success e warning como cores do Tailwind', () => {
    expect(css).toContain('--color-success: var(--success)')
    expect(css).toContain('--color-warning: var(--warning)')
  })

  it('usa Space Mono como fonte mono', () => {
    expect(css).toContain('--font-mono: var(--font-space-mono)')
  })
})
