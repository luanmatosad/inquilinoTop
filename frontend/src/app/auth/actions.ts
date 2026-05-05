'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { login as goLogin, register as goRegister, logout as goLogout, setTokens } from '@/lib/go/client'
import { z } from 'zod'

import { isRedirectError } from 'next/dist/client/components/redirect-error'

const authSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres' }),
})

const registerSchema = z.object({
  fullName: z.string().min(3, { message: 'Nome completo é obrigatório' }),
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres' }),
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
    return {
      error: error instanceof Error ? error.message : 'Erro ao fazer login',
    }
  }

  if (success) {
    redirect('/')
  }
  return null
}

export async function signup(prevState: ActionState, formData: FormData) {
  const fullName = formData.get('fullName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

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
    return {
      error: error instanceof Error ? error.message : 'Erro ao criar conta',
    }
  }

  if (success) {
    redirect('/')
  }
  return null
}

export async function logout() {
  await goLogout()
  revalidatePath('/', 'layout')
  redirect('/login')
}