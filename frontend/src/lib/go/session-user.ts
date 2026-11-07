import { getToken } from './server-auth'

/**
 * Id do usuário no payload do JWT (`owner_id`). Só serve para rotular a tela ("por você");
 * a autorização é sempre do backend, que valida a assinatura.
 */
export function userIdFromToken(token: string | null | undefined): string | null {
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { owner_id?: unknown }
    return typeof json.owner_id === 'string' && json.owner_id ? json.owner_id : null
  } catch {
    return null
  }
}

export async function sessionUserId(): Promise<string | null> {
  return userIdFromToken(await getToken())
}
