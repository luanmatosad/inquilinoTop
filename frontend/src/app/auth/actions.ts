'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { login as goLogin, register as goRegister, logout as goLogout } from '@/lib/go/client'
import { z } from 'zod'

const authSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(8, { message: 'A senha deve ter no mínimo 8 caracteres' }),
})

export type ActionState = {
  error?: string
  success?: string
} | null

export async function login(prevState: ActionState, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const result = authSchema.safeParse({ email, password })
  if (!result.success) {
    return {
      error: result.error.issues[0].message,
    }
  }

  try {
    await goLogin(email, password)
    revalidatePath('/', 'layout')
    redirect('/')
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Erro ao fazer login',
    }
  }
}

export async function signup(prevState: ActionState, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const result = authSchema.safeParse({ email, password })
  if (!result.success) {
    return {
      error: result.error.issues[0].message,
    }
  }

  try {
    await goRegister(email, password)
    return {
      success: 'Conta criada! Faça login para continuar.',
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Erro ao criar conta',
    }
  }
}

export async function logout() {
  await goLogout()
  revalidatePath('/', 'layout')
  redirect('/login')
}