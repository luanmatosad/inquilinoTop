import { describe, it, expect } from 'vitest'

import { preserveAddress } from '@/lib/tenant-form'

const values = { name: 'Marina Souza', person_type: 'PF' as const, email: 'novo@email.com' }

describe('preserveAddress', () => {
  const initial = {
    postal_code: '69100000',
    address_line: 'Rua Quinze, 120',
    city: 'Itacoatiara',
    state: 'AM',
  }

  it('devolve o endereço antigo mesmo quando o formulário não o tem', () => {
    expect(preserveAddress(values, initial)).toMatchObject(initial)
  })

  it('não mexe nos campos editados', () => {
    expect(preserveAddress(values, initial)).toMatchObject({ name: 'Marina Souza', email: 'novo@email.com' })
  })

  it('o endereço antigo vale mesmo se o formulário trouxer outro valor', () => {
    const r = preserveAddress({ ...values, city: 'Manaus' }, initial)
    expect(r.city).toBe('Itacoatiara')
  })

  it('sem dados iniciais (cadastro novo): não inventa endereço', () => {
    const r = preserveAddress(values, undefined)
    expect(r).not.toHaveProperty('postal_code')
    expect(r).not.toHaveProperty('address_line')
  })

  it('inquilino sem endereço gravado: continua sem endereço', () => {
    const r = preserveAddress(values, { postal_code: null, address_line: null, city: null, state: null })
    expect(r.postal_code).toBeUndefined()
    expect(r.city).toBeUndefined()
  })

  it('o payload final envia o endereço antigo ao backend', async () => {
    const { toTenantPayload } = await import('@/lib/schemas')
    const body = toTenantPayload(preserveAddress(values, initial))
    expect(body).toMatchObject({ postal_code: '69100000', address_line: 'Rua Quinze, 120', city: 'Itacoatiara', state: 'AM' })
  })
})
