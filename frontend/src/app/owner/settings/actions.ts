"use server"

import { getOwnerSettings, upsertOwnerSettings } from "@/data/owner/preferences-dal"
import { revalidatePath } from "next/cache"

interface Settings {
  notify_payment_overdue: boolean
  notify_lease_expiring: boolean
  notify_lease_expiring_days: number
  notify_new_message: boolean
  notify_maintenance_request: boolean
  notify_payment_received: boolean
}

export async function loadSettings(): Promise<Settings> {
  const settings = await getOwnerSettings()
  
  return {
    notify_payment_overdue: settings?.notify_payment_overdue ?? true,
    notify_lease_expiring: settings?.notify_lease_expiring ?? true,
    notify_lease_expiring_days: settings?.notify_lease_expiring_days ?? 30,
    notify_new_message: settings?.notify_new_message ?? true,
    notify_maintenance_request: settings?.notify_maintenance_request ?? true,
    notify_payment_received: settings?.notify_payment_received ?? true,
  }
}

interface FormState {
  success?: boolean
  errors?: Record<string, string[]>
}

export async function updateSettingsAction(formData: FormData): Promise<FormState> {
  const notify_payment_overdue = formData.get("notify_payment_overdue") === "on"
  const notify_lease_expiring = formData.get("notify_lease_expiring") === "on"
  const notify_lease_expiring_days = formData.get("notify_lease_expiring_days") as string
  const notify_new_message = formData.get("notify_new_message") === "on"
  const notify_maintenance_request = formData.get("notify_maintenance_request") === "on"
  const notify_payment_received = formData.get("notify_payment_received") === "on"

  try {
    await upsertOwnerSettings({
      notify_payment_overdue,
      notify_lease_expiring,
      notify_lease_expiring_days: notify_lease_expiring_days ? Number(notify_lease_expiring_days) : 30,
      notify_new_message,
      notify_maintenance_request,
      notify_payment_received,
    })
    
    revalidatePath("/owner/settings")
    return { success: true }
  } catch (error) {
    console.error("Error updating settings:", error)
    return { errors: { _form: ["Erro ao salvar configurações"] } }
  }
}