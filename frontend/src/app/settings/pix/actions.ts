'use server'

import { revalidatePath } from 'next/cache'

import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import { parsePixForm, type PixFormInput } from '@/lib/pix-settings'

export type PixResult = { success: true } | { error: string; fieldErrors?: Partial<Record<keyof PixFormInput, string>> }

const ERRORS: Record<string, string> = {
  INVALID_PIX_KEY: 'A chave não é válida para o tipo escolhido.',
  INVALID_PIX: 'O nome vai até 25 caracteres e a cidade até 15.',
  CONFIRMATION_REQUIRED: 'Confirme que o titular da chave autorizou receber os pagamentos desta unidade.',
  NOT_FOUND: 'Unidade não encontrada.',
}

function failure(error: unknown, fallback: string): PixResult {
  const { code, status } = goErrorInfo(error)
  if (status === 403) return { error: 'Só o dono da conta pode alterar o Pix.' }
  if (code && ERRORS[code]) return { error: ERRORS[code] }
  console.error(fallback, error)
  return { error: fallback }
}

/** Grava a chave padrão (valida no servidor, com as mesmas regras do backend). */
export async function savePix(input: PixFormInput): Promise<PixResult> {
  const parsed = parsePixForm(input)
  if (!parsed.ok) return { error: 'Confira os campos.', fieldErrors: parsed.errors }
  try {
    await goFetch('/api/v1/settings/pix', { method: 'PUT', body: JSON.stringify(parsed.value) })
    revalidateAll()
    return { success: true }
  } catch (error) {
    return failure(error, 'Erro ao salvar o Pix.')
  }
}

/** Conta Pix de uma unidade. `confirmed` precisa vir marcado (o servidor também exige). */
export async function saveUnitPix(unitId: string, input: Pick<PixFormInput, 'key_type' | 'key' | 'receiver_name'>, confirmed: boolean): Promise<PixResult> {
  if (!confirmed) return { error: ERRORS.CONFIRMATION_REQUIRED }
  const parsed = parsePixForm({ ...input, city: '' })
  if (!parsed.ok) return { error: 'Confira os campos.', fieldErrors: parsed.errors }
  try {
    await goFetch(`/api/v1/settings/pix/units/${encodeURIComponent(unitId)}`, {
      method: 'PUT',
      body: JSON.stringify({ key_type: parsed.value.key_type, key: parsed.value.key, receiver_name: parsed.value.receiver_name, confirmed: true }),
    })
    revalidateAll()
    return { success: true }
  } catch (error) {
    return failure(error, 'Erro ao salvar a chave da unidade.')
  }
}

/** Volta a unidade para a chave padrão (a conta fica no histórico). */
export async function removeUnitPix(unitId: string): Promise<PixResult> {
  try {
    await goFetch(`/api/v1/settings/pix/units/${encodeURIComponent(unitId)}`, { method: 'DELETE' })
    revalidateAll()
    return { success: true }
  } catch (error) {
    return failure(error, 'Erro ao voltar para a chave padrão.')
  }
}

function revalidateAll() {
  revalidatePath('/settings/pix')
  revalidatePath('/') // o checklist de Hoje olha se o Pix está configurado
  revalidatePath('/financial/receivables')
}
