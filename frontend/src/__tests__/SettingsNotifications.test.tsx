import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const getOwnerSettings = vi.hoisted(() => vi.fn())
const upsertOwnerSettings = vi.hoisted(() => vi.fn())
vi.mock('@/data/owner/preferences-dal', () => ({ getOwnerSettings, upsertOwnerSettings }))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { saveNotifications } from '@/app/settings/notifications/actions'
import NotificationsPage from '@/app/settings/notifications/page'

const prefs = {
  user_id: 'u1',
  notify_payment_overdue: true,
  notify_lease_expiring: true,
  notify_lease_expiring_days: 45,
  notify_new_message: false,
  notify_maintenance_request: true,
  notify_payment_received: true,
  created_at: '',
  updated_at: '',
}

function form(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  getOwnerSettings.mockReset().mockResolvedValue(prefs)
  upsertOwnerSettings.mockReset().mockResolvedValue(prefs)
  revalidatePath.mockReset()
  Object.values(toast).forEach((f) => f.mockReset())
})

describe('saveNotifications (action)', () => {
  it('grava as três escolhas e preserva o que a tela não mostra', async () => {
    const res = await saveNotifications(null, form({ notify_payment_received: 'on', notify_lease_expiring: 'on', notify_lease_expiring_days: '20' }))
    expect(res).toEqual({ success: 'Preferências salvas.' })
    expect(upsertOwnerSettings).toHaveBeenCalledWith({
      notify_payment_received: true,
      notify_payment_overdue: false, // não veio marcado
      notify_lease_expiring: true,
      notify_lease_expiring_days: 20,
      notify_new_message: false, // preservado
      notify_maintenance_request: true, // preservado
    })
    expect(revalidatePath).toHaveBeenCalledWith('/settings/notifications')
  })

  it('contrato vencendo desligado mantém os dias gravados', async () => {
    await saveNotifications(null, form({ notify_payment_received: 'on', notify_payment_overdue: 'on' }))
    expect(upsertOwnerSettings.mock.calls[0][0]).toMatchObject({ notify_lease_expiring: false, notify_lease_expiring_days: 45 })
  })

  it('sem as preferências atuais não grava (para não apagar o que está escondido)', async () => {
    getOwnerSettings.mockResolvedValue(null)
    const res = await saveNotifications(null, form({ notify_payment_received: 'on' }))
    expect(res?.error).toMatch(/carregar/)
    expect(upsertOwnerSettings).not.toHaveBeenCalled()
  })

  it('falha ao gravar devolve erro', async () => {
    upsertOwnerSettings.mockRejectedValue(new Error('boom'))
    const res = await saveNotifications(null, form({ notify_payment_received: 'on' }))
    expect(res?.error).toBe('Erro ao salvar as preferências.')
  })
})

describe('Tela de notificações', () => {
  const renderPage = async () => render(await NotificationsPage())

  it('mostra as três linhas, os dias e o aviso de que os avisos chegam em breve', async () => {
    await renderPage()
    expect(screen.getByText('Inquilino avisou que pagou')).toBeTruthy()
    expect(screen.getByText('Cobrança em atraso')).toBeTruthy()
    expect(screen.getByText('Contrato vencendo')).toBeTruthy()
    expect((screen.getByLabelText(/Avisar com antecedência/) as HTMLInputElement).value).toBe('45')
    expect(screen.getByText(/os avisos no app chegam em breve/)).toBeTruthy()
    expect(screen.queryByText(/Nova mensagem|Manutenção/i)).toBeNull()
  })

  it('desligar "Contrato vencendo" esconde os dias', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('switch', { name: 'Contrato vencendo' }))
    expect(screen.queryByLabelText(/Avisar com antecedência/)).toBeNull()
  })

  it('preferências indisponíveis: mensagem e sem formulário', async () => {
    getOwnerSettings.mockResolvedValue(null)
    await renderPage()
    expect(screen.getByText(/Não foi possível carregar suas preferências/)).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
