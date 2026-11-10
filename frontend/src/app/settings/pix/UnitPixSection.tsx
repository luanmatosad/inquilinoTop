'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PIX_KEY_TYPES, maskPixKey, parsePixForm, type PixDefault, type PixFormInput, type UnitPix } from '@/lib/pix-settings'
import { removeUnitPix, saveUnitPix } from './actions'

export type UnitRow = { id: string; label: string }

type Props = { units: UnitRow[]; accounts: UnitPix[]; defaultAccount: PixDefault }

const select = 'flex h-11 w-full rounded-md border bg-background px-3 text-sm shadow-xs md:h-9'

export function UnitPixSection({ units, accounts, defaultAccount }: Props) {
  const [editing, setEditing] = useState<UnitRow | null>(null)
  const byUnit = new Map(accounts.map((a) => [a.unit_id, a]))

  return (
    <section aria-label="Receber em outra conta por imóvel" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">Receber em outra conta por imóvel</h3>
        <p className="text-sm text-muted-foreground">Use quando um imóvel é de outra pessoa ou empresa. Cada cobrança sai com a chave do imóvel.</p>
      </div>
      {units.length === 0 ? (
        <p role="status" className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          Cadastre um imóvel para escolher onde ele recebe.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {units.map((u) => {
            const own = byUnit.get(u.id)
            const recebe = own ? maskPixKey(own.key_type, own.key) : defaultAccount.configured && defaultAccount.key_type && defaultAccount.key ? maskPixKey(defaultAccount.key_type, defaultAccount.key) : 'Chave padrão não definida'
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{u.label}</span>
                  <span className="text-xs text-muted-foreground">{recebe}</span>
                </div>
                <Badge variant="outline">{own ? 'Outra chave' : 'Chave padrão'}</Badge>
                <Button variant="outline" size="sm" onClick={() => setEditing(u)} aria-label={`${own ? 'Editar' : 'Usar outra chave em'} ${u.label}`}>
                  {own ? 'Editar' : 'Usar outra chave'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">O ImoviFlow não guarda nem repassa seu dinheiro. Ele só monta o Pix para você cobrar.</p>

      {editing && <UnitPixSheet key={editing.id} unit={editing} current={byUnit.get(editing.id)} onClose={() => setEditing(null)} />}
    </section>
  )
}

function UnitPixSheet({ unit, current, onClose }: { unit: UnitRow; current?: UnitPix; onClose: () => void }) {
  const [form, setForm] = useState<Pick<PixFormInput, 'key_type' | 'key' | 'receiver_name'>>({
    key_type: current?.key_type ?? '',
    key: current?.key ?? '',
    receiver_name: current?.receiver_name ?? '',
  })
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof PixFormInput, string>>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const placeholder = PIX_KEY_TYPES.find((t) => t.value === form.key_type)?.placeholder

  async function save() {
    setFormError('')
    const parsed = parsePixForm({ ...form, city: '' })
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      const res = await saveUnitPix(unit.id, form, confirmed)
      if ('error' in res) {
        setErrors(res.fieldErrors ?? {})
        setFormError(res.error)
        return
      }
      toast.success('Chave da unidade salva.')
      onClose()
    } catch {
      setFormError('Ocorreu um erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  async function useDefault() {
    setBusy(true)
    setFormError('')
    try {
      const res = await removeUnitPix(unit.id)
      if ('error' in res) {
        setFormError(res.error)
        return
      }
      toast.success('A unidade voltou a usar a chave padrão.')
      onClose()
    } catch {
      setFormError('Ocorreu um erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Chave Pix do imóvel</SheetTitle>
          <SheetDescription>{unit.label}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6 pb-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit-key-type">Tipo de chave</Label>
            <select id="unit-key-type" value={form.key_type} onChange={set('key_type')} className={select}>
              <option value="" disabled>
                Escolha o tipo
              </option>
              {PIX_KEY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {errors.key_type && (
              <p role="alert" className="text-xs text-destructive">
                {errors.key_type}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit-key">Chave Pix</Label>
            <Input id="unit-key" value={form.key} onChange={set('key')} placeholder={placeholder} aria-invalid={!!errors.key} />
            {errors.key && (
              <p role="alert" className="text-xs text-destructive">
                {errors.key}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit-name">Nome de quem recebe</Label>
            <Input id="unit-name" value={form.receiver_name} onChange={set('receiver_name')} maxLength={40} aria-describedby="unit-name-hint" />
            <p id="unit-name-hint" className="text-xs text-muted-foreground">
              Precisa ser o titular da conta. O inquilino vê esse nome antes de pagar.
            </p>
            {errors.receiver_name && (
              <p role="alert" className="text-xs text-destructive">
                {errors.receiver_name}
              </p>
            )}
          </div>

          <div role="note" className="flex flex-col gap-1 rounded-lg border bg-muted p-3 text-sm">
            <span className="font-medium">Antes de salvar</span>
            <span className="text-muted-foreground">Os pagamentos desse imóvel vão para outra conta, não para a sua. Confirme com o dono do imóvel e guarde o combinado.</span>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Confirmo que o titular dessa chave autorizou receber os pagamentos deste imóvel.
          </label>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {current && (
              <Button variant="ghost" onClick={useDefault} disabled={busy}>
                Usar chave padrão
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={busy || !confirmed || !form.key.trim()}>
                {busy ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
