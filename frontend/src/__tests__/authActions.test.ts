import { describe, it, expect, vi, beforeEach } from 'vitest'

const client = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  setTokens: vi.fn(),
}))
vi.mock('@/lib/go/client', () => client)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { login, signup } from '@/app/auth/actions'

const form = (data: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}
const goError = (message: string, code: string, status: number) =>
  Object.assign(new Error(message), { code, status })

beforeEach(() => {
  Object.values(client).forEach((fn) => fn.mockReset())
})

describe('login', () => {
  it('senha errada vira mensagem amigável', async () => {
    client.login.mockRejectedValue(goError('credenciais inválidas', 'INVALID_CREDENTIALS', 401))
    const r = await login(null, form({ email: 'a@b.com', password: 'qualquer1' }))
    expect(r).toEqual({ error: 'E-mail ou senha incorretos.' })
  })

  it('backend fora do ar não vaza erro técnico', async () => {
    client.login.mockRejectedValue(new TypeError('fetch failed'))
    const r = await login(null, form({ email: 'a@b.com', password: 'qualquer1' }))
    expect(r).toEqual({ error: 'Não foi possível conectar ao servidor. Tente novamente em instantes.' })
  })

  it('aceita senha curta de contas antigas (o backend decide)', async () => {
    client.login.mockResolvedValue({ access_token: 'a', refresh_token: 'r' })
    await login(null, form({ email: 'a@b.com', password: '123' }))
    expect(client.login).toHaveBeenCalledWith('a@b.com', '123')
  })

  it('e-mail inválido é barrado antes de chamar o backend', async () => {
    const r = await login(null, form({ email: 'sem-arroba', password: 'qualquer1' }))
    expect(r).toEqual({ error: 'E-mail inválido' })
    expect(client.login).not.toHaveBeenCalled()
  })
})

describe('signup', () => {
  const valid = { fullName: 'Maria Souza', email: 'a@b.com', password: 'senha1234', confirmPassword: 'senha1234' }

  it('e-mail duplicado vira mensagem amigável, sem SQL', async () => {
    client.register.mockRejectedValue(goError('este e-mail já está cadastrado', 'EMAIL_TAKEN', 409))
    const r = await signup(null, form(valid))
    expect(r).toEqual({ error: 'Este e-mail já está cadastrado. Tente entrar.' })
  })

  it('texto interno inesperado não chega ao usuário', async () => {
    client.register.mockRejectedValue(
      goError('identity.repo: ERROR: duplicate key (SQLSTATE 23505)', 'REGISTER_FAILED', 500),
    )
    const r = await signup(null, form(valid))
    expect(r).toEqual({ error: 'Não foi possível criar a conta agora. Tente novamente.' })
  })

  it('exige 8 caracteres, igual ao backend', async () => {
    const r = await signup(null, form({ ...valid, password: 'curta12', confirmPassword: 'curta12' }))
    expect(r).toEqual({ error: 'A senha deve ter no mínimo 8 caracteres' })
    expect(client.register).not.toHaveBeenCalled()
  })
})
