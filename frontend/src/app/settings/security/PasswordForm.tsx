'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { passwordSchema } from '@/lib/security-schemas'
import { changePassword } from './actions'

const empty = { current_password: '', new_password: '', confirm_password: '' }

export function PasswordForm() {
  const [values, setValues] = useState(empty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const parsed = passwordSchema.safeParse(values)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }
    setBusy(true)
    try {
      const res = await changePassword(parsed.data)
      if ('error' in res) {
        setError(res.error)
        return
      }
      toast.success('Senha alterada.')
      setValues(empty)
    } catch {
      setError('Ocorreu um erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current_password">Senha atual</Label>
        <Input id="current_password" type="password" autoComplete="current-password" value={values.current_password} onChange={set('current_password')} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new_password">Nova senha</Label>
        <Input id="new_password" type="password" autoComplete="new-password" value={values.new_password} onChange={set('new_password')} />
        <span className="text-xs text-muted-foreground">No mínimo 8 caracteres.</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm_password">Confirmar a nova senha</Label>
        <Input id="confirm_password" type="password" autoComplete="new-password" value={values.confirm_password} onChange={set('confirm_password')} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando...' : 'Alterar senha'}
        </Button>
      </div>
    </form>
  )
}
