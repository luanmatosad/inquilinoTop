import { describe, it, expect } from 'vitest'
import { SETTINGS_SECTIONS, activeSection } from '@/lib/settings-nav'
import { buildPreferencesPayload, type NotificationPrefs } from '@/lib/notification-settings'
import { passwordSchema, twoFactorCodeSchema } from '@/lib/security-schemas'

describe('settings-nav', () => {
  it('lista as 11 seções do canvas, na ordem', () => {
    expect(SETTINGS_SECTIONS.map((s) => s.label)).toEqual([
      'Perfil',
      'Personalização',
      'Equipe e permissões',
      'Plano e cobrança',
      'Recebimento (Pix)',
      'Mensagens e cobrança',
      'Regras financeiras',
      'Categorias de despesa',
      'Notificações',
      'Segurança',
      'Privacidade e dados',
    ])
  })
  it('as sem tela são "em breve" e não têm link', () => {
    const soon = SETTINGS_SECTIONS.filter((s) => s.soon).map((s) => s.label)
    expect(soon).toEqual(['Personalização', 'Plano e cobrança', 'Mensagens e cobrança', 'Regras financeiras', 'Categorias de despesa', 'Privacidade e dados'])
    for (const s of SETTINGS_SECTIONS.filter((s) => s.soon)) expect(s.href).toBeUndefined()
  })
  it('as com tela têm link; Pix leva à tela atual', () => {
    const href = Object.fromEntries(SETTINGS_SECTIONS.filter((s) => s.href).map((s) => [s.label, s.href]))
    expect(href).toEqual({
      Perfil: '/settings/profile',
      'Equipe e permissões': '/settings/team',
      'Recebimento (Pix)': '/settings/financial',
      Notificações: '/settings/notifications',
      Segurança: '/settings/security',
    })
  })
  it('activeSection acha a seção pelo caminho', () => {
    expect(activeSection('/settings/security')?.label).toBe('Segurança')
    expect(activeSection('/settings/financial')?.label).toBe('Recebimento (Pix)')
    expect(activeSection('/settings/team/qualquer')?.label).toBe('Equipe e permissões')
    expect(activeSection('/settings')).toBeUndefined()
    expect(activeSection('/leases')).toBeUndefined()
  })
})

const current: NotificationPrefs = {
  notify_payment_overdue: true,
  notify_lease_expiring: true,
  notify_lease_expiring_days: 45,
  notify_new_message: false,
  notify_maintenance_request: true,
  notify_payment_received: true,
}

describe('buildPreferencesPayload', () => {
  it('mantém os campos que a tela não mostra', () => {
    const p = buildPreferencesPayload(current, { paymentReceived: false, paymentOverdue: true, leaseExpiring: true, leaseExpiringDays: 20 })
    expect(p.notify_new_message).toBe(false)
    expect(p.notify_maintenance_request).toBe(true)
    expect(p.notify_payment_received).toBe(false)
    expect(p.notify_lease_expiring_days).toBe(20)
  })
  it('contrato vencendo desligado mantém os dias gravados', () => {
    const p = buildPreferencesPayload(current, { paymentReceived: true, paymentOverdue: true, leaseExpiring: false, leaseExpiringDays: undefined })
    expect(p.notify_lease_expiring).toBe(false)
    expect(p.notify_lease_expiring_days).toBe(45)
  })
  it('dias inválidos voltam ao gravado (ou 30 sem gravado)', () => {
    for (const bad of ['0', '91', 'abc', '', '2.5']) {
      expect(buildPreferencesPayload(current, { paymentReceived: true, paymentOverdue: true, leaseExpiring: true, leaseExpiringDays: bad }).notify_lease_expiring_days).toBe(45)
    }
    expect(buildPreferencesPayload(null, { paymentReceived: true, paymentOverdue: true, leaseExpiring: true, leaseExpiringDays: 'x' }).notify_lease_expiring_days).toBe(30)
  })
  it('sem preferências gravadas: ocultos ligados', () => {
    const p = buildPreferencesPayload(null, { paymentReceived: true, paymentOverdue: false, leaseExpiring: true, leaseExpiringDays: 30 })
    expect(p.notify_new_message).toBe(true)
    expect(p.notify_maintenance_request).toBe(true)
    expect(p.notify_payment_overdue).toBe(false)
  })
})

describe('security-schemas', () => {
  const ok = { current_password: 'senha123', new_password: 'novasenha1', confirm_password: 'novasenha1' }
  it('aceita senha válida', () => {
    expect(passwordSchema.safeParse(ok).success).toBe(true)
  })
  it('recusa curta, diferente da confirmação e igual à atual', () => {
    expect(passwordSchema.safeParse({ ...ok, new_password: 'curta', confirm_password: 'curta' }).success).toBe(false)
    expect(passwordSchema.safeParse({ ...ok, confirm_password: 'outra1234' }).success).toBe(false)
    expect(passwordSchema.safeParse({ ...ok, new_password: 'senha123', confirm_password: 'senha123' }).success).toBe(false)
    expect(passwordSchema.safeParse({ ...ok, current_password: '' }).success).toBe(false)
  })
  it('código de 6 dígitos', () => {
    expect(twoFactorCodeSchema.safeParse('123456').success).toBe(true)
    for (const bad of ['12345', '1234567', 'abcdef', '12 456', '']) expect(twoFactorCodeSchema.safeParse(bad).success).toBe(false)
  })
})
