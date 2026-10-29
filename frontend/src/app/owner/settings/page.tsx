import { Suspense } from "react"
import { loadSettings, updateSettingsAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Settings {
  notify_payment_overdue: boolean
  notify_lease_expiring: boolean
  notify_lease_expiring_days: number
  notify_new_message: boolean
  notify_maintenance_request: boolean
  notify_payment_received: boolean
}

async function SettingsForm() {
  const settings = await loadSettings()

  return (
    <form action={updateSettingsAction} className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Notificações</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Pagamento Atrasado</p>
              <p className="text-sm text-muted-foreground">Receber alerta quando houver pagamento atrasado</p>
            </div>
            <Switch
              name="notify_payment_overdue"
              defaultChecked={settings.notify_payment_overdue}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Contrato Expirando</p>
              <p className="text-sm text-muted-foreground">Receber alerta antes do fim do contrato</p>
            </div>
            <Switch
              name="notify_lease_expiring"
              defaultChecked={settings.notify_lease_expiring}
            />
          </div>

          {settings.notify_lease_expiring && (
            <div className="ml-6 flex items-center gap-4">
              <Label htmlFor="notify_lease_expiring_days" className="text-sm">
                Notificar com antecedência de (dias)
              </Label>
              <Input
                id="notify_lease_expiring_days"
                type="number"
                name="notify_lease_expiring_days"
                defaultValue={settings.notify_lease_expiring_days}
                min="1"
                max="90"
                className="w-24"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Nova Mensagem</p>
              <p className="text-sm text-muted-foreground">Receber notificação de novas mensagens</p>
            </div>
            <Switch
              name="notify_new_message"
              defaultChecked={settings.notify_new_message}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Solicitação de Manutenção</p>
              <p className="text-sm text-muted-foreground">Receber alerta de novas solicitações</p>
            </div>
            <Switch
              name="notify_maintenance_request"
              defaultChecked={settings.notify_maintenance_request}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Pagamento Recebido</p>
              <p className="text-sm text-muted-foreground">Receber confirmação de pagamento</p>
            </div>
            <Switch
              name="notify_payment_received"
              defaultChecked={settings.notify_payment_received}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="default">
          Salvar Configurações
        </Button>
      </div>
    </form>
  )
}

export default async function OwnerSettingsPage() {
  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-base text-muted-foreground mt-1">
          Gerencie suas preferências e notificações.
        </p>
      </div>

      <Suspense fallback={<div>Carregando configurações...</div>}>
        <SettingsForm />
      </Suspense>
    </div>
  )
}