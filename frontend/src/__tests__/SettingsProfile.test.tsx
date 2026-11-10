import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@/app/settings/profile/actions', () => ({ updateProfile: vi.fn(), getProfile: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ProfileForm } from '@/app/settings/profile/ProfileForm'

describe('Perfil', () => {
  const data = { email: 'luan@email.com', full_name: 'Luan Matos', person_type: 'PF' as const, document: '12345678909', phone: '11999990000', address_line: 'Rua A, 1', city: 'Manaus', state: 'AM' }

  it('e-mail só leitura e os campos de sempre continuam editáveis', () => {
    render(<ProfileForm initialData={data} />)
    const email = screen.getByLabelText('E-mail') as HTMLInputElement
    expect(email.value).toBe('luan@email.com')
    expect(email.disabled).toBe(true)
    expect(email.name).toBe('')
    for (const name of ['full_name', 'person_type', 'document', 'phone', 'address_line', 'city', 'state']) {
      expect(document.querySelector(`[name="${name}"]`)).toBeTruthy()
    }
    expect(screen.getByText('Dados para contratos e recibos')).toBeTruthy()
    expect(screen.getByLabelText('Celular (WhatsApp)')).toBeTruthy()
  })

  it('sem perfil gravado: formulário vazio, e-mail ainda aparece', () => {
    render(<ProfileForm initialData={{ email: 'novo@email.com' }} />)
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('novo@email.com')
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('')
  })
})
