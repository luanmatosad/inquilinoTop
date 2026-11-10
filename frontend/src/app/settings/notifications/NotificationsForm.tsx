'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SubmitButton } from '@/components/ui/submit-button'
import type { NotificationPrefs } from '@/lib/notification-settings'
import { saveNotifications } from './actions'

function Row({ id, name, title, text, defaultChecked, onChange }: { id: string; name: string; title: string; text: string; defaultChecked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col">
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <span className="text-sm text-muted-foreground">{text}</span>
      </div>
      <Switch id={id} name={name} defaultChecked={defaultChecked} onCheckedChange={onChange} />
    </div>
  )
}

export function NotificationsForm({ prefs }: { prefs: NotificationPrefs }) {
  const [state, action] = useActionState(saveNotifications, null)
  const [expiring, setExpiring] = useState(prefs.notify_lease_expiring)

  useEffect(() => {
    if (state?.success) toast.success(state.success)
    else if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="divide-y rounded-xl border bg-card px-4">
        <Row id="n-received" name="notify_payment_received" title="Inquilino avisou que pagou" text="Para você confirmar o recebimento." defaultChecked={prefs.notify_payment_received} />
        <Row id="n-overdue" name="notify_payment_overdue" title="Cobrança em atraso" text="Aviso quando passar do vencimento." defaultChecked={prefs.notify_payment_overdue} />
        <div className="py-3">
          <Row id="n-expiring" name="notify_lease_expiring" title="Contrato vencendo" text="Para decidir renovar ou encerrar." defaultChecked={prefs.notify_lease_expiring} onChange={setExpiring} />
          {expiring && (
            <div className="flex items-center gap-3 pb-1">
              <Label htmlFor="n-days" className="text-sm">
                Avisar com antecedência de (dias)
              </Label>
              <Input id="n-days" name="notify_lease_expiring_days" type="number" min={1} max={90} defaultValue={prefs.notify_lease_expiring_days} className="w-24" />
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Suas escolhas ficam salvas; os avisos no app chegam em breve. As cobranças para o inquilino continuam sendo enviadas por você, pelo seu WhatsApp.
      </p>
      <div className="flex justify-end">
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  )
}
