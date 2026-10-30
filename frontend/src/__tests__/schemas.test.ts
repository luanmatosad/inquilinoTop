import { describe, it, expect } from 'vitest'
import {
  propertySchema,
  unitSchema,
  tenantSchema,
  toPropertyPayload,
  toUnitPayload,
  toTenantPayload,
} from '@/lib/schemas'

const okProperty = { name: 'Prédio', type: 'RESIDENTIAL' as const }

describe('propertySchema', () => {
  it('aceita só o obrigatório', () => {
    expect(propertySchema.safeParse(okProperty).success).toBe(true)
  })
  it('aceita CEP com máscara e rejeita CEP incompleto', () => {
    expect(propertySchema.safeParse({ ...okProperty, postal_code: '01310-100' }).success).toBe(true)
    const r = propertySchema.safeParse({ ...okProperty, postal_code: '0131' })
    expect(r.success).toBe(false)
  })
  it('UF precisa de 2 letras', () => {
    expect(propertySchema.safeParse({ ...okProperty, state: 'SP' }).success).toBe(true)
    expect(propertySchema.safeParse({ ...okProperty, state: 'S' }).success).toBe(false)
  })
  it('payload envia CEP só com dígitos e omite vazios', () => {
    const p = toPropertyPayload({ ...okProperty, postal_code: '01310-100', neighborhood: '', city: 'SP' })
    expect(p.postal_code).toBe('01310100')
    expect(p.neighborhood).toBeUndefined()
    expect(p.city).toBe('SP')
  })
})

describe('unitSchema', () => {
  it('aceita medidas válidas', () => {
    expect(unitSchema.safeParse({ label: '101', area_m2: '54,5', bedrooms: '2', bathrooms: '1' }).success).toBe(true)
  })
  it('rejeita área zero/negativa/não numérica', () => {
    for (const v of ['0', '-3', 'abc']) {
      expect(unitSchema.safeParse({ label: '101', area_m2: v }).success).toBe(false)
    }
  })
  it('rejeita quartos/banheiros negativos ou fracionados', () => {
    expect(unitSchema.safeParse({ label: '101', bedrooms: '-1' }).success).toBe(false)
    expect(unitSchema.safeParse({ label: '101', bathrooms: '1.5' }).success).toBe(false)
  })
  it('payload converte vírgula decimal e números', () => {
    const p = toUnitPayload({ label: '101', area_m2: '54,5', bedrooms: '2', bathrooms: '' })
    expect(p.area_m2).toBe(54.5)
    expect(p.bedrooms).toBe(2)
    expect(p.bathrooms).toBeUndefined()
  })
})

describe('tenantSchema', () => {
  const base = { name: 'Ana Souza', person_type: 'PF' as const }
  it('documento é opcional', () => {
    expect(tenantSchema.safeParse(base).success).toBe(true)
    expect(tenantSchema.safeParse({ ...base, document: '' }).success).toBe(true)
  })
  it('PF exige CPF válido', () => {
    expect(tenantSchema.safeParse({ ...base, document: '529.982.247-25' }).success).toBe(true)
    const r = tenantSchema.safeParse({ ...base, document: '529.982.247-26' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.document).toBeTruthy()
  })
  it('PJ exige CNPJ válido', () => {
    const pj = { name: 'Empresa', person_type: 'PJ' as const }
    expect(tenantSchema.safeParse({ ...pj, document: '11.222.333/0001-81' }).success).toBe(true)
    expect(tenantSchema.safeParse({ ...pj, document: '529.982.247-25' }).success).toBe(false)
  })
  it('payload envia dígitos de documento, CEP e telefone', () => {
    const p = toTenantPayload({
      ...base,
      document: '529.982.247-25',
      postal_code: '01310-100',
      phone: '(11) 99999-8888',
      email: '',
    })
    expect(p.document).toBe('52998224725')
    expect(p.postal_code).toBe('01310100')
    expect(p.phone).toBe('11999998888')
    expect(p.email).toBeUndefined()
  })
})
