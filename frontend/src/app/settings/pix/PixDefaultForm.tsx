'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PIX_KEY_TYPES, parsePixForm, type PixDefault, type PixFormInput } from '@/lib/pix-settings'
import { savePix } from './actions'

type Props = {
  value: PixDefault
  /** Chave antiga (financial_config) sugerida enquanto a organização não salvou nada aqui. */
  legacy?: { key: string; type: PixFormInput['key_type'] }
}

const select =
  'flex h-11 w-full rounded-md border bg-background px-3 text-sm shadow-xs md:h-9'

export function PixDefaultForm({ value, legacy }: Props) {
  const suggested = !value.configured && !!legacy
  const [form, setForm] = useState<PixFormInput>({
    key_type: value.key_type ?? legacy?.type ?? '',
    key: value.key ?? legacy?.key ?? '',
    receiver_name: value.receiver_name ?? '',
    city: value.city ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PixFormInput, string>>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k: keyof PixFormInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const placeholder = PIX_KEY_TYPES.find((t) => t.value === form.key_type)?.placeholder

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const parsed = parsePixForm(form)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      const res = await savePix(form)
      if ('error' in res) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error)
        return
      }
      toast.success('Pix salvo.')
    } catch {
      setFormError('Ocorreu um erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  const err = (k: keyof PixFormInput) =>
    errors[k] ? (
      <p id={`pix-${k}-error`} role="alert" className="text-xs text-destructive">
        {errors[k]}
      </p>
    ) : null

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {suggested && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Esta é a chave que você já usava. Confira e salve para confirmar.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pix-key-type">Tipo de chave</Label>
        <select id="pix-key-type" value={form.key_type} onChange={set('key_type')} className={`${select} md:max-w-60`}>
          <option value="" disabled>
            Escolha o tipo
          </option>
          {PIX_KEY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {err('key_type')}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pix-key">Chave Pix</Label>
        <Input id="pix-key" value={form.key} onChange={set('key')} placeholder={placeholder} aria-invalid={!!errors.key} aria-describedby={errors.key ? 'pix-key-error' : undefined} />
        {err('key')}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pix-name">Nome de quem recebe</Label>
        <Input id="pix-name" value={form.receiver_name} onChange={set('receiver_name')} maxLength={40} aria-describedby="pix-name-hint" />
        <p id="pix-name-hint" className="text-xs text-muted-foreground">
          Aparece para o inquilino na hora de pagar. Vazio usa o nome do seu perfil.
        </p>
        {err('receiver_name')}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pix-city">Cidade</Label>
        <Input id="pix-city" value={form.city} onChange={set('city')} maxLength={30} aria-describedby="pix-city-hint" />
        <p id="pix-city-hint" className="text-xs text-muted-foreground">
          Vazio usa a cidade do imóvel.
        </p>
        {err('city')}
      </div>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
