'use server'

import { acceptInvite } from '@/lib/go/organization'
import { goErrorInfo } from '@/lib/go/errors'
import { refreshAccessToken } from '@/lib/go/server-auth'

export type AcceptInviteResult = { ok: true } | { ok: false; code?: string; message: string }

const GENERIC_MESSAGE = 'Não foi possível aceitar o convite agora. Tente novamente.'

// Retorna o resultado em vez de lançar: em produção o Next redige a mensagem de erros lançados
// por server actions, e o cliente precisa do código e do texto do backend.
export async function acceptInviteAction(token: string): Promise<AcceptInviteResult> {
  try {
    await acceptInvite(token)
  } catch (err) {
    const { code, status, message } = goErrorInfo(err, GENERIC_MESSAGE)
    if (code === 'ALREADY_HAS_ORG') {
      return { ok: false, code, message: 'Você já participa de uma organização.' }
    }
    if (message === 'UNAUTHORIZED') {
      return { ok: false, message: 'Sua sessão expirou. Entre novamente para aceitar o convite.' }
    }
    // Sem status a falha não veio do backend (ex.: rede): não expõe texto técnico.
    if (status === undefined) return { ok: false, message: GENERIC_MESSAGE }
    return { ok: false, code, message }
  }

  // Token novo carrega organization_id; sem refresh o middleware manda de volta ao onboarding.
  if (!(await refreshAccessToken())) {
    return {
      ok: false,
      message: 'Convite aceito, mas não foi possível atualizar sua sessão. Entre novamente.',
    }
  }
  return { ok: true }
}
