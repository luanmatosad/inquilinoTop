'use server'

import QRCode from 'qrcode'
import { revalidatePath } from 'next/cache'

import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import { passwordSchema, twoFactorCodeSchema, type PasswordValues } from '@/lib/security-schemas'

type Failure = { error: string }

const PASSWORD_ERRORS: Record<string, string> = {
  INVALID_PASSWORD: 'A senha atual está incorreta.',
  WEAK_PASSWORD: 'A nova senha deve ter no mínimo 8 caracteres.',
  SAME_PASSWORD: 'A nova senha deve ser diferente da atual.',
}

export async function changePassword(values: PasswordValues): Promise<{ success: true } | Failure> {
  const parsed = passwordSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  try {
    await goFetch('/api/v1/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: parsed.data.current_password, new_password: parsed.data.new_password }),
    })
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code && PASSWORD_ERRORS[code]) return { error: PASSWORD_ERRORS[code] }
    console.error('Erro ao trocar a senha:', error)
    return { error: 'Erro ao trocar a senha.' }
  }
}

/** Começa a ativação: o backend guarda um segredo pendente (o 2FA só liga na confirmação do código). */
export async function startTwoFactor(): Promise<{ secret: string; qrSvg: string } | Failure> {
  try {
    const res = await goFetch<{ secret: string; qr_code_url: string }>('/api/v1/auth/2fa/setup', { method: 'POST' })
    const qrSvg = await QRCode.toString(res.qr_code_url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
    return { secret: res.secret, qrSvg }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code === 'ALREADY_ENABLED') return { error: 'A verificação em duas etapas já está ligada.' }
    console.error('Erro ao iniciar o 2FA:', error)
    return { error: 'Erro ao iniciar a verificação em duas etapas.' }
  }
}

/** Confere o código, liga o 2FA e devolve os códigos de recuperação (só aparecem aqui). */
export async function confirmTwoFactor(code: string): Promise<{ backupCodes: string[] } | Failure> {
  const parsed = twoFactorCodeSchema.safeParse(code)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Código inválido.' }
  try {
    const res = await goFetch<{ backup_codes: string[] }>('/api/v1/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code: parsed.data }) })
    revalidatePath('/settings/security')
    return { backupCodes: res.backup_codes ?? [] }
  } catch (error) {
    const { code: errCode } = goErrorInfo(error)
    if (errCode === 'INVALID_CODE') return { error: 'Código incorreto. Confira o aplicativo e tente de novo.' }
    if (errCode === 'NOT_CONFIGURED') return { error: 'Comece a ativação de novo para gerar um QR Code.' }
    if (errCode === 'ALREADY_ENABLED') return { error: 'A verificação em duas etapas já está ligada.' }
    console.error('Erro ao confirmar o 2FA:', error)
    return { error: 'Erro ao confirmar o código.' }
  }
}

export async function disableTwoFactor(password: string): Promise<{ success: true } | Failure> {
  if (!password) return { error: 'Informe a sua senha.' }
  try {
    await goFetch('/api/v1/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) })
    revalidatePath('/settings/security')
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code === 'DISABLE_2FA_FAILED') return { error: 'Senha incorreta.' }
    console.error('Erro ao desativar o 2FA:', error)
    return { error: 'Erro ao desativar a verificação em duas etapas.' }
  }
}
