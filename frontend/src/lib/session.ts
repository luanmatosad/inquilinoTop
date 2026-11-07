type CookieReader = { get(name: string): { value: string } | undefined }

/** Sessão só existe com access_token E refresh_token (mesma regra do middleware). */
export function hasSession(store: CookieReader): boolean {
  return Boolean(store.get('access_token')?.value && store.get('refresh_token')?.value)
}

/**
 * Destino das páginas quando o backend rejeita um access token que o middleware ainda considera
 * válido (ex.: rotação de chave JWT). O parâmetro `session=expired` faz o middleware NÃO mandar o
 * usuário de /login de volta para /, evitando o loop / -> /login -> /.
 */
export const SESSION_EXPIRED_LOGIN_URL = '/login?session=expired'
