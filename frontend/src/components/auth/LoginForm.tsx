'use client'

import { useActionState, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { login, signup, type ActionState } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from '@/components/ui/input-group'
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react'

type LoginFormProps = {
  mode: 'login' | 'signup'
}

export function LoginForm({ mode }: LoginFormProps) {
  const isLogin = mode === 'login'
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    isLogin ? login : signup,
    null
  )

  return (
    <div className="flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-[418px] flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            {isLogin ? 'Bem-vindo ao ImoviFlow' : 'Crie sua conta no ImoviFlow'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin
              ? 'Informe seu e-mail e senha para entrar.'
              : 'Preencha os dados abaixo para começar.'}
          </p>
        </div>

        <button
          type="button"
          disabled
          aria-disabled
          title="Em breve"
          className="flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-border bg-input px-2.5 shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Image src="/icons/google.svg" alt="" width={16} height={16} />
          <span className="text-sm font-medium text-foreground">Entrar com a conta Google</span>
        </button>

        <div className="flex items-center gap-1">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">Ou</span>
          <Separator className="flex-1" />
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <InputGroup>
                <InputGroupAddon>
                  <User className="text-muted-foreground w-5 h-5" />
                </InputGroupAddon>
                <InputGroupInput id="fullName" name="fullName" required minLength={3} placeholder="João da Silva" />
              </InputGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <InputGroup>
              <InputGroupAddon>
                <Mail className="text-muted-foreground w-5 h-5" />
              </InputGroupAddon>
              <InputGroupInput id="email" name="email" required type="email" placeholder="Seu e-mail" />
            </InputGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <InputGroup>
              <InputGroupAddon>
                <Lock className="text-muted-foreground w-5 h-5" />
              </InputGroupAddon>
              <InputGroupInput
                id="password"
                name="password"
                required
                minLength={6}
                type={showPassword ? 'text' : 'password'}
                placeholder="Sua senha"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <InputGroup>
                <InputGroupAddon>
                  <Lock className="text-muted-foreground w-5 h-5" />
                </InputGroupAddon>
                <InputGroupInput
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  minLength={6}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                />
              </InputGroup>
            </div>
          )}

          {state?.error && (
            <div className="text-destructive text-sm font-medium">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="text-green-600 text-sm font-medium">
              {state.success}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isLogin ? 'Entrar' : 'Criar conta'}
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href={isLogin ? '/login?mode=signup' : '/login'}>
              {isLogin ? 'Não possui conta? Cadastra-se' : 'Já tem conta? Entrar'}
            </Link>
          </Button>
        </form>
      </div>
    </div>
  )
}
