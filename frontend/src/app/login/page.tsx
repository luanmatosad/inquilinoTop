'use client'

import { useActionState } from 'react'
import { login, signup, type ActionState } from '@/app/auth/actions'
import { Button, Input, Card } from '@heroui/react'
import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Building2 } from 'lucide-react'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    isLogin ? login : signup,
    null
  )

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-[420px] flex flex-col gap-6">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center gap-1">
          <div className="bg-primary-container/10 p-2 rounded-xl text-primary-container inline-flex mb-2">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">InquilinoTop</h1>
          <p className="text-base text-on-surface-variant">Gestão imobiliária moderna.</p>
        </div>

        {/* Login Card */}
        <Card className="relative overflow-hidden">
          <Card.Header className="pb-2">
            <div className="flex bg-surface-container-low p-1 rounded-lg relative mb-4">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors relative z-10 ${
                  isLogin 
                    ? 'bg-surface-container-lowest text-primary-container shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors relative z-10 ${
                  !isLogin 
                    ? 'bg-surface-container-lowest text-primary-container shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Cadastrar
              </button>
            </div>
            <Card.Title className="text-xl">
              {isLogin ? 'Acessar painel' : 'Criar conta'}
            </Card.Title>
            <Card.Description>
              {isLogin
                ? 'Entre com suas credenciais para acessar o sistema.'
                : 'Preencha os dados abaixo para criar sua conta.'}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-on-surface-variant ml-1" htmlFor="email">
                  E-mail
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 text-outline w-5 h-5" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs text-on-surface-variant" htmlFor="password">
                    Senha
                  </label>
                  <a className="text-xs text-primary-container hover:underline" href="#">
                    Esqueceu a senha?
                  </a>
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 text-outline w-5 h-5" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-outline hover:text-on-surface transition-colors flex items-center justify-center"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {state?.error && (
                <div className="text-error text-sm font-medium">
                  {state.error}
                </div>
              )}
              
              {state?.success && (
                <div className="text-green-600 text-sm font-medium">
                  {state.success}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full mt-2"
                isPending={isPending}
              >
                {isLogin ? 'Acessar painel' : 'Criar conta'}
              </Button>
            </form>
          </Card.Content>
        </Card>

        {/* Minimal Footer */}
        <div className="text-center">
          <p className="text-xs text-outline">
            Protegido por reCAPTCHA. <a className="hover:text-on-surface underline" href="#">Privacidade</a> e <a className="hover:text-on-surface underline" href="#">Termos</a> aplicáveis.
          </p>
        </div>
      </div>
    </div>
  )
}