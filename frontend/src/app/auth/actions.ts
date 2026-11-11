'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { login as goLogin, register as goRegister, logout as goLogout, setTokens } from '@/lib/go/client'
import { z } from 'zod'

import { authErrorMessage } from '@/lib/go/authErrors'
import { safeNextPath } from '@/lib/safe-next'

import { isRedirectError } from 'next/dist/client/components/redirect-error'

// Login só exige senha preenchida: quem decide se está certa é o backend (contas antigas podem
// ter senha curta). O cadastro segue a regra do backend: no mínimo 8 caracteres.
const authSchema = z.object({
  email: z.string().email({ message: 'E-mail inválido' }),
  password: z.string().min(1, { message: 'Informe a senha' }),
})

const MIN_PASSWORD = 8

const registerSchema = z.object({
  fullName: z.string().min(3, { message: 'Nome completo é obrigatório' }),
  email: z.string().email({ message: 'E-mail inválido' }),
  password: z.string().min(MIN_PASSWORD, { message: `A senha deve ter no mínimo ${MIN_PASSWORD} caracteres` }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
})

export type ActionState = {
  error?: string
  success?: string
} | null | undefined

export async function login(prevState: ActionState, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = safeNextPath(formData.get('next'))

  const result = authSchema.safeParse({ email, password })
  if (!result.success) {
    return {
      error: result.error.issues[0].message,
    }
  }

  let success = false
  try {
    const res = await goLogin(email, password)
    await setTokens(res.access_token, res.refresh_token)
    revalidatePath('/', 'layout')
    success = true
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: authErrorMessage(error, 'login') }
  }

  if (success) {
    redirect(next)
  }
}

export async function signup(prevState: ActionState, formData: FormData) {
  const fullName = formData.get('fullName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const next = safeNextPath(formData.get('next'))

  const result = registerSchema.safeParse({ fullName, email, password, confirmPassword })
  if (!result.success) {
    return {
      error: result.error.issues[0].message,
    }
  }

  let success = false
  try {
    const res = await goRegister(email, password)
    await setTokens(res.access_token, res.refresh_token)
    revalidatePath('/', 'layout')
    success = true
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: authErrorMessage(error, 'signup') }
  }

  if (success) {
    redirect(next)
  }
}

export async function logout() {
  await goLogout()
  revalidatePath('/', 'layout')
  redirect('/login')
}