import { describe, it, expect } from 'vitest'
import { hasSession } from '@/lib/session'

const store = (values: Record<string, string>) => ({
  get: (name: string) => (name in values ? { value: values[name] } : undefined),
})

describe('hasSession', () => {
  it('exige access_token e refresh_token', () => {
    expect(hasSession(store({ access_token: 'a', refresh_token: 'r' }))).toBe(true)
    expect(hasSession(store({ access_token: 'a' }))).toBe(false)
    expect(hasSession(store({ refresh_token: 'r' }))).toBe(false)
    expect(hasSession(store({ access_token: '', refresh_token: 'r' }))).toBe(false)
    expect(hasSession(store({}))).toBe(false)
  })
})
