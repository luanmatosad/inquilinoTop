'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  MAX_BODY,
  MAX_REMINDERS,
  REMINDER_VARIABLES,
  SAMPLE_VARIABLES,
  insertAtCursor,
  offsetLabel,
  renderTemplate,
  validateReminders,
  type Reminder,
} from '@/lib/message-templates'
import { saveReminders } from './actions'

type When = 'before' | 'same' | 'after'
type Draft = { name: string; when: When; days: string; body: string }

const toDraft = (r?: Reminder): Draft =>
  r
    ? { name: r.name, when: r.offset_days < 0 ? 'before' : r.offset_days > 0 ? 'after' : 'same', days: String(Math.abs(r.offset_days) || ''), body: r.body }
    : { name: '', when: 'after', days: '1', body: '' }

function toReminder(d: Draft): Reminder {
  const n = /^\d+$/.test(d.days.trim()) ? Number(d.days.trim()) : NaN
  return { name: d.name.trim(), offset_days: d.when === 'same' ? 0 : d.when === 'before' ? -n : n, body: d.body.trim() }
}

const select = 'flex h-11 w-full rounded-md border bg-background px-3 text-sm shadow-xs md:h-9'
const byDays = (a: Reminder, b: Reminder) => a.offset_days - b.offset_days

export function RemindersSection({ reminders: initial }: { reminders: Reminder[] }) {
  const [list, setList] = useState<Reminder[]>([...initial].sort(byDays))
  const [editing, setEditing] = useState<{ index: number | null } | null>(null)

  return (
    <section aria-label="Lembretes" className="flex flex-col gap-3">
      <ul className="divide-y rounded-xl border bg-card">
        {list.map((r, i) => (
          <li key={`${r.offset_days}-${r.name}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{offsetLabel(r.offset_days)}</span>
              <span className="text-xs text-muted-foreground">{r.name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing({ index: i })} aria-label={`Editar ${r.name}`}>
              Editar
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="self-start" onClick={() => setEditing({ index: null })} disabled={list.length >= MAX_REMINDERS}>
        <Plus aria-hidden="true" />
        Adicionar lembrete
      </Button>
      {list.length >= MAX_REMINDERS && <p className="text-xs text-muted-foreground">O máximo é de {MAX_REMINDERS} lembretes.</p>}

      {editing && (
        <ReminderSheet
          key={editing.index ?? 'novo'}
          index={editing.index}
          list={list}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setList([...saved].sort(byDays))
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

function ReminderSheet({ index, list, onClose, onSaved }: { index: number | null; list: Reminder[]; onClose: () => void; onSaved: (l: Reminder[]) => void }) {
  const current = index === null ? undefined : list[index]
  const [draft, setDraft] = useState<Draft>(() => toDraft(current))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const pendingCursor = useRef<number | null>(null)

  useEffect(() => {
    if (pendingCursor.current !== null && ref.current) {
      ref.current.focus()
      ref.current.setSelectionRange(pendingCursor.current, pendingCursor.current)
      pendingCursor.current = null
    }
  }, [draft.body])

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const preview = renderTemplate(draft.body, SAMPLE_VARIABLES)

  function insert(token: string) {
    const el = ref.current
    const { text, cursor } = insertAtCursor(draft.body, el?.selectionStart ?? null, el?.selectionEnd ?? null, token)
    pendingCursor.current = cursor
    set({ body: text })
  }

  const others = list.filter((_, i) => i !== index)
  const next = (): Reminder[] => [...others, toReminder(draft)]

  async function persist(nextList: Reminder[], okMessage: string) {
    setError('')
    const problem = validateReminders(nextList)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    try {
      const res = await saveReminders(nextList)
      if ('error' in res) {
        setError(res.error)
        return
      }
      toast.success(okMessage)
      onSaved(res.reminders)
    } catch {
      setError('Ocorreu um erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{current ? 'Editar lembrete' : 'Novo lembrete'}</SheetTitle>
          <SheetDescription>Toque numa variável para inserir no texto.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6 pb-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rem-name">Nome</Label>
            <Input id="rem-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={50} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rem-when">Quando</Label>
            <div className="flex gap-2">
              <select id="rem-when" value={draft.when} onChange={(e) => set({ when: e.target.value as When })} className={select}>
                <option value="before">Dias antes do vencimento</option>
                <option value="same">No dia do vencimento</option>
                <option value="after">Dias depois do vencimento</option>
              </select>
              {draft.when !== 'same' && (
                <Input aria-label="Quantos dias" inputMode="numeric" value={draft.days} onChange={(e) => set({ days: e.target.value })} className="w-20" />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rem-body">Modelo da mensagem</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Variáveis">
              {REMINDER_VARIABLES.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  title={v.hint}
                  onClick={() => insert(v.token)}
                  className="inline-flex h-7 items-center rounded-full border bg-background px-2.5 text-xs font-medium hover:bg-accent"
                >
                  {v.token}
                </button>
              ))}
            </div>
            <Textarea id="rem-body" ref={ref} rows={7} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
            <span className="text-xs text-muted-foreground">
              {Array.from(draft.body).length} de {MAX_BODY} caracteres
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Prévia com dados da Marina</span>
            <div aria-label="Prévia" role="region" className="whitespace-pre-wrap rounded-lg border bg-muted p-3 text-sm">
              {preview || <span className="text-muted-foreground">O texto aparece aqui.</span>}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {current && (
              <Button variant="ghost" onClick={() => persist(others, 'Lembrete removido.')} disabled={busy || list.length <= 1}>
                Remover
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={() => persist(next(), 'Lembrete salvo.')} disabled={busy}>
                {busy ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
