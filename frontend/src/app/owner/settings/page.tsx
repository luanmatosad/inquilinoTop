import { Suspense } from "react"
import { loadSettings, updateSettingsAction } from "./actions"
import { Button, Card, Switch } from "@heroui/react"


async function SettingsForm() {
  const settings = await loadSettings()

  async function handleAction(formData: FormData) {
    "use server"
    await updateSettingsAction(formData)
  }

  return (
    <form action={handleAction} className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Notificações</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Pagamento Atrasado</p>
              <p className="text-sm text-on-surface-variant">Receber alerta quando houver pagamento atrasado</p>
            </div>
            <Switch
              name="notify_payment_overdue"
              defaultSelected={settings.notify_payment_overdue}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Contrato Expirando</p>
              <p className="text-sm text-on-surface-variant">Receber alerta antes do fim do contrato</p>
            </div>
            <Switch
              name="notify_lease_expiring"
              defaultSelected={settings.notify_lease_expiring}
            />
          </div>

          {settings.notify_lease_expiring && (
            <div className="ml-6">
              <label className="text-sm">Notificar com antecedência de (dias)</label>
              <input
                type="number"
                name="notify_lease_expiring_days"
                defaultValue={settings.notify_lease_expiring_days}
                min="1"
                max="90"
                className="ml-4 p-2 border rounded"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Nova Mensagem</p>
              <p className="text-sm text-on-surface-variant">Receber notificação de novas mensagens</p>
            </div>
            <Switch
              name="notify_new_message"
              defaultSelected={settings.notify_new_message}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Solicitação de Manutenção</p>
              <p className="text-sm text-on-surface-variant">Receber alerta de novas solicitações</p>
            </div>
            <Switch
              name="notify_maintenance_request"
              defaultSelected={settings.notify_maintenance_request}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Pagamento Recebido</p>
              <p className="text-sm text-on-surface-variant">Receber confirmação de pagamento</p>
            </div>
            <Switch
              name="notify_payment_received"
              defaultSelected={settings.notify_payment_received}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">
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
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Configurações</h1>
        <p className="text-base text-on-surface-variant mt-1">
          Gerencie suas preferências e notificações.
        </p>
      </div>

      <Suspense fallback={<div>Carregando configurações...</div>}>
        <SettingsForm />
      </Suspense>
    </div>
  )
}