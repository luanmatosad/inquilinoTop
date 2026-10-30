'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react'

import { completeInspection, deleteInspection, deleteItem, updateInspection } from '@/app/inspections/actions'
import { CONDITION_LABELS, INSPECTION_STATUS_LABELS, INSPECTION_TYPE_LABELS, type Condition } from '@/lib/inspection-schemas'
import { formatDate, type InspectionDetail } from '@/lib/inspection-data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ItemFormDialog } from './ItemFormDialog'
import { PhotoGrid } from './PhotoGrid'

const CONDITION_VARIANT: Record<Condition, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  GOOD: 'default',
  FAIR: 'secondary',
  POOR: 'outline',
  DAMAGED: 'destructive',
  NOT_APPLICABLE: 'outline',
}

function Confirm({ trigger, title, description, action, onConfirm }: {
  trigger: React.ReactNode; title: string; description: string; action: string; onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function InspectionEditor({ inspection, leaseLabel, copiedFromEntry }: {
  inspection: InspectionDetail
  leaseLabel: string
  copiedFromEntry: boolean
}) {
  const router = useRouter()
  const readOnly = inspection.status === 'COMPLETED'
  const [date, setDate] = useState(inspection.inspected_at.slice(0, 10))
  const [notes, setNotes] = useState(inspection.general_notes ?? '')
  const [saving, setSaving] = useState(false)

  const rooms = new Map<string, InspectionDetail['items']>()
  for (const it of inspection.items) rooms.set(it.room, [...(rooms.get(it.room) ?? []), it])

  async function saveDetails() {
    setSaving(true)
    const result = await updateInspection(inspection.id, { inspected_at: date, general_notes: notes })
    setSaving(false)
    if (result.error) toast.error(result.error)
    else toast.success('Laudo salvo.')
  }

  async function complete() {
    const result = await completeInspection(inspection.id)
    if (result.error) toast.error(result.error)
    else toast.success('Laudo concluído. Ele não pode mais ser alterado.')
  }

  async function remove() {
    const result = await deleteInspection(inspection.id)
    if (result.error) return toast.error(result.error)
    toast.success('Laudo excluído.')
    router.push('/inspections')
  }

  async function removeItem(itemId: string) {
    const result = await deleteItem(inspection.id, itemId)
    if (result.error) toast.error(result.error)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Laudo de {INSPECTION_TYPE_LABELS[inspection.type].toLowerCase()}</h1>
          <p className="text-muted-foreground">{leaseLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={readOnly ? 'default' : 'secondary'}>{INSPECTION_STATUS_LABELS[inspection.status]}</Badge>
          {!readOnly && (
            <>
              <Confirm
                trigger={<Button variant="outline"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>}
                title="Excluir laudo?"
                description="O laudo some da lista e libera este tipo para um novo laudo no contrato."
                action="Excluir"
                onConfirm={remove}
              />
              <Confirm
                trigger={<Button><CheckCircle2 className="mr-2 h-4 w-4" />Concluir</Button>}
                title="Concluir laudo?"
                description="Depois de concluído, o laudo, os itens e as fotos não podem mais ser alterados."
                action="Concluir"
                onConfirm={complete}
              />
            </>
          )}
        </div>
      </div>

      {!readOnly && copiedFromEntry && (
        <div role="status" className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Os itens foram copiados do laudo de entrada com as mesmas condições. Reavalie cada item antes de concluir.
        </div>
      )}

      <Card className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="inspected_at">Data da vistoria</Label>
            <Input id="inspected_at" type="date" value={date} disabled={readOnly} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="general_notes">Observações gerais</Label>
            <Textarea id="general_notes" rows={2} value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        {readOnly ? (
          <p className="text-sm text-muted-foreground">
            Concluído em {inspection.completed_at ? formatDate(inspection.completed_at) : '—'}.
          </p>
        ) : (
          <div className="flex justify-end">
            <Button variant="outline" disabled={saving || !date} onClick={saveDetails}>Salvar dados</Button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Itens ({inspection.items.length})</h2>
        {!readOnly && (
          <ItemFormDialog inspectionId={inspection.id} trigger={<Button><Plus className="mr-2 h-4 w-4" />Adicionar item</Button>} />
        )}
      </div>

      {rooms.size === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border bg-card text-muted-foreground">
          Nenhum item ainda. Adicione os ambientes e itens da vistoria.
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[...rooms.keys()]} className="rounded-xl border bg-card px-4">
          {[...rooms.entries()].map(([room, items]) => (
            <AccordionItem key={room} value={room}>
              <AccordionTrigger>{room} <span className="ml-2 text-sm font-normal text-muted-foreground">({items.length})</span></AccordionTrigger>
              <AccordionContent className="space-y-4">
                {items.map((it) => (
                  <div key={it.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{it.item}</span>
                        <Badge variant={CONDITION_VARIANT[it.condition]}>{CONDITION_LABELS[it.condition]}</Badge>
                      </div>
                      {!readOnly && (
                        <div className="flex gap-1">
                          <ItemFormDialog
                            inspectionId={inspection.id}
                            item={it}
                            trigger={<Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${it.item}`}><Pencil className="h-4 w-4" /></Button>}
                          />
                          <Confirm
                            trigger={<Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remover ${it.item}`}><Trash2 className="h-4 w-4" /></Button>}
                            title="Remover item?"
                            description="O item e suas fotos saem do laudo."
                            action="Remover"
                            onConfirm={() => removeItem(it.id)}
                          />
                        </div>
                      )}
                    </div>
                    {it.notes && <p className="text-sm text-muted-foreground">{it.notes}</p>}
                    <PhotoGrid inspectionId={inspection.id} itemId={it.id} photos={it.photos ?? []} readOnly={readOnly} />
                  </div>
                ))}
                {!readOnly && (
                  <ItemFormDialog
                    inspectionId={inspection.id}
                    defaultRoom={room}
                    trigger={<Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Item em {room}</Button>}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}
