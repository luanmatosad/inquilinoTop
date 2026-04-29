'use client'

import { useActionState } from 'react'
import { login, signup, type ActionState } from '@/app/auth/actions'
import { Button, Card, TextField, Label, InputGroup, FieldError } from '@heroui/react'
import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Building2, User } from 'lucide-react'

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
            <form action={formAction} className="flex flex-col gap-6">
              {!isLogin && (
                <TextField name="fullName" isRequired minLength={3}>
                  <Label>Nome Completo</Label>
                  <InputGroup>
                    <InputGroup.Prefix>
                      <User className="text-outline w-5 h-5" />
                    </InputGroup.Prefix>
                    <InputGroup.Input placeholder="João da Silva" />
                  </InputGroup>
                </TextField>
              )}

              <TextField name="email" isRequired type="email">
                <Label>E-mail</Label>
                <InputGroup>
                  <InputGroup.Prefix>
                    <Mail className="text-outline w-5 h-5" />
                  </InputGroup.Prefix>
                  <InputGroup.Input placeholder="voce@exemplo.com" />
                </InputGroup>
              </TextField>

              <TextField name="password" isRequired minLength={6}>
                <div className="flex justify-between items-center">
                  <Label>Senha</Label>
                  {isLogin && (
                    <a className="text-xs text-primary-container hover:underline" href="#">
                      Esqueceu a senha?
                    </a>
                  )}
                </div>
                <InputGroup>
                  <InputGroup.Prefix>
                    <Lock className="text-outline w-5 h-5" />
                  </InputGroup.Prefix>
                  <InputGroup.Input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••"
                  />
                  <InputGroup.Suffix>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-outline hover:text-on-surface transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </InputGroup.Suffix>
                </InputGroup>
              </TextField>

              {!isLogin && (
                <TextField name="confirmPassword" isRequired minLength={6}>
                  <Label>Confirmar Senha</Label>
                  <InputGroup>
                    <InputGroup.Prefix>
                      <Lock className="text-outline w-5 h-5" />
                    </InputGroup.Prefix>
                    <InputGroup.Input 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="••••••••"
                    />
                  </InputGroup>
                </TextField>
              )}

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