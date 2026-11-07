import { goErrorInfo } from '@/lib/go/errors'

type AuthContext = 'login' | 'signup'

// Códigos do backend (identity) traduzidos para o usuário. Qualquer outro código cai na mensagem
// genérica: o texto do backend pode conter detalhes internos (SQL, nomes de pacote) e nunca é exibido.
const byCode: Record<string, string> = {
  EMAIL_TAKEN: 'Este e-mail já está cadastrado. Tente entrar.',
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  WEAK_PASSWORD: 'A senha deve ter no mínimo 8 caracteres.',
  INVALID_EMAIL: 'E-mail inválido.',
  MISSING_FIELDS: 'Preencha e-mail e senha.',
  TWO_FACTOR_REQUIRED:
    'Esta conta usa verificação em duas etapas, que ainda não está disponível nesta tela.',
}

const generic: Record<AuthContext, string> = {
  login: 'Não foi possível entrar agora. Tente novamente.',
  signup: 'Não foi possível criar a conta agora. Tente novamente.',
}

export function authErrorMessage(err: unknown, context: AuthContext): string {
  if (!(err instanceof Error)) return generic[context]

  const { code, status } = goErrorInfo(err)
  if (code && byCode[code]) return byCode[code]
  if (status === 429) return 'Muitas tentativas. Aguarde um instante e tente de novo.'
  // goFetch só anexa status a respostas HTTP; sem ele a requisição nem chegou ao backend.
  if (status === undefined && err instanceof TypeError) {
    return 'Não foi possível conectar ao servidor. Tente novamente em instantes.'
  }
  return generic[context]
}
