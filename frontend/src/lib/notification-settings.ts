// Preferências de aviso (spec notification-settings). O PUT do backend substitui tudo: o que a tela não mostra
// (nova mensagem e manutenção) volta com o valor gravado, como `preserveAddress` em Inquilinos.
export type NotificationPrefs = {
  notify_payment_overdue: boolean
  notify_lease_expiring: boolean
  notify_lease_expiring_days: number
  notify_new_message: boolean
  notify_maintenance_request: boolean
  notify_payment_received: boolean
}

export type NotificationForm = {
  paymentReceived: boolean
  paymentOverdue: boolean
  leaseExpiring: boolean
  /** Texto do campo (ou número); só vale inteiro de 1 a 90. */
  leaseExpiringDays?: string | number
}

const DEFAULT_DAYS = 30

function validDays(v: string | number | undefined): number | undefined {
  const s = String(v ?? '').trim()
  if (!/^\d+$/.test(s)) return undefined
  const n = Number(s)
  return n >= 1 && n <= 90 ? n : undefined
}

export function buildPreferencesPayload(current: Partial<NotificationPrefs> | null, form: NotificationForm): NotificationPrefs {
  return {
    notify_payment_received: form.paymentReceived,
    notify_payment_overdue: form.paymentOverdue,
    notify_lease_expiring: form.leaseExpiring,
    notify_lease_expiring_days: (form.leaseExpiring ? validDays(form.leaseExpiringDays) : undefined) ?? current?.notify_lease_expiring_days ?? DEFAULT_DAYS,
    notify_new_message: current?.notify_new_message ?? true,
    notify_maintenance_request: current?.notify_maintenance_request ?? true,
  }
}
