import { describe, it, expect } from 'vitest'

import { authErrorMessage } from '@/lib/go/authErrors'

const goError = (message: string, code?: string, status?: number) =>
  Object.assign(new Error(message), { code, status })

describe('authErrorMessage', () => {
  it.each([
    ['EMAIL_TAKEN', 409, 'signup', 'Este e-mail já está cadastrado. Tente entrar.'],
    ['INVALID_CREDENTIALS', 401, 'login', 'E-mail ou senha incorretos.'],
    ['WEAK_PASSWORD', 400, 'signup', 'A senha deve ter no mínimo 8 caracteres.'],
    ['INVALID_EMAIL', 400, 'signup', 'E-mail inválido.'],
    ['MISSING_FIELDS', 400, 'login', 'Preencha e-mail e senha.'],
    [
      'TWO_FACTOR_REQUIRED',
      200,
      'login',
      'Esta conta usa verificação em duas etapas, que ainda não está disponível nesta tela.',
    ],
  ] as const)('código %s', (code, status, context, expected) => {
    expect(authErrorMessage(goError('texto interno do backend', code, status), context)).toBe(expected)
  })

  it('429 pede para aguardar', () => {
    expect(authErrorMessage(goError('too many', 'RATE_LIMITED', 429), 'login')).toBe(
      'Muitas tentativas. Aguarde um instante e tente de novo.',
    )
  })

  it('falha de rede (sem status) fala em conexão', () => {
    expect(authErrorMessage(new TypeError('fetch failed'), 'login')).toBe(
      'Não foi possível conectar ao servidor. Tente novamente em instantes.',
    )
  })

  it.each([
    ['login', 'Não foi possível entrar agora. Tente novamente.'],
    ['signup', 'Não foi possível criar a conta agora. Tente novamente.'],
  ] as const)('erro desconhecido em %s: mensagem genérica', (context, expected) => {
    expect(authErrorMessage(goError('x', 'REGISTER_FAILED', 500), context)).toBe(expected)
  })

  it.each(['UNAUTHORIZED', 'INVALID_JSON_RESPONSE', 'REQUEST_FAILED'])(
    'sentinela interna %s não vaza',
    (message) => {
      expect(authErrorMessage(new Error(message), 'login')).not.toContain(message)
    },
  )

  it('nunca repassa texto de banco ou de pacote interno', () => {
    const leaked = goError(
      'identity.svc: create user: ERROR: duplicate key value violates unique constraint (SQLSTATE 23505)',
      'SOMETHING_NEW',
      500,
    )
    const msg = authErrorMessage(leaked, 'signup')
    expect(msg).not.toMatch(/identity\.|SQLSTATE|duplicate key/)
  })

  it('valor que não é Error também vira mensagem genérica', () => {
    expect(authErrorMessage('boom', 'login')).toBe('Não foi possível entrar agora. Tente novamente.')
  })
})
