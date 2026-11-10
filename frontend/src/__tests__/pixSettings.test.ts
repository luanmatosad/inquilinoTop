import { describe, it, expect } from 'vitest'
import { PIX_KEY_TYPES, normalizePixKey, maskPixKey, inferKeyType, parsePixForm } from '@/lib/pix-settings'

describe('PIX_KEY_TYPES', () => {
  it('os cinco tipos do canvas, na ordem', () => {
    expect(PIX_KEY_TYPES.map((t) => t.value)).toEqual(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'])
    expect(PIX_KEY_TYPES.map((t) => t.label)).toEqual(['CPF', 'CNPJ', 'E-mail', 'Celular', 'Chave aleatória'])
  })
})

describe('normalizePixKey (espelha o backend)', () => {
  const ok = (type: string, raw: string) => {
    const r = normalizePixKey(type as never, raw)
    return r.ok ? r.value : `ERRO: ${r.error}`
  }
  it('formas gravadas', () => {
    expect(ok('CPF', '529.982.247-25')).toBe('52998224725')
    expect(ok('CNPJ', '11.222.333/0001-81')).toBe('11222333000181')
    expect(ok('EMAIL', '  Socio@Email.COM ')).toBe('socio@email.com')
    expect(ok('PHONE', '(92) 99999-0000')).toBe('+5592999990000')
    expect(ok('PHONE', '92 3333-0000')).toBe('+559233330000')
    expect(ok('PHONE', '+55 92 99999-0000')).toBe('+5592999990000')
    expect(ok('PHONE', '5592999990000')).toBe('+5592999990000')
    expect(ok('RANDOM', '123E4567-E89B-12D3-A456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000')
  })
  it('recusa o que o backend recusa, com mensagem por tipo', () => {
    const bad: [string, string, RegExp][] = [
      ['CPF', '529.982.247-26', /CPF/],
      ['CPF', '111.111.111-11', /CPF/],
      ['CNPJ', '11.222.333/0001-82', /CNPJ/],
      ['EMAIL', 'sem-arroba', /e-mail/i],
      ['EMAIL', 'a@b', /e-mail/i],
      ['PHONE', '123', /celular/i],
      ['PHONE', '+1 202 555 0100', /celular/i],
      ['RANDOM', 'nao-e-uuid', /aleatória/i],
      ['CPF', '', /CPF/],
    ]
    for (const [type, raw, msg] of bad) {
      const r = normalizePixKey(type as never, raw)
      expect(r.ok, `${type} ${raw}`).toBe(false)
      if (!r.ok) expect(r.error).toMatch(msg)
    }
    expect(normalizePixKey('EMAIL', 'a'.repeat(70) + '@email.com').ok).toBe(false)
  })
})

describe('maskPixKey', () => {
  it('como o canvas: CPF mascarado; CNPJ e e-mail inteiros', () => {
    expect(maskPixKey('CPF', '52998224725')).toBe('CPF ···.247-25')
    expect(maskPixKey('CNPJ', '11222333000181')).toBe('CNPJ 11.222.333/0001-81')
    expect(maskPixKey('EMAIL', 'socio@email.com')).toBe('E-mail socio@email.com')
  })
  it('celular e chave aleatória parcialmente ocultos', () => {
    expect(maskPixKey('PHONE', '+5592999990000')).toBe('Celular (92) ·····-0000')
    expect(maskPixKey('RANDOM', '123e4567-e89b-12d3-a456-426614174000')).toBe('Chave 123e4567…4000')
  })
})

describe('inferKeyType (chave antiga sem tipo)', () => {
  it('deduz pelo formato', () => {
    expect(inferKeyType('529.982.247-25')).toBe('CPF')
    expect(inferKeyType('11222333000181')).toBe('CNPJ')
    expect(inferKeyType('socio@email.com')).toBe('EMAIL')
    expect(inferKeyType('+5592999990000')).toBe('PHONE')
    expect(inferKeyType('11999998888')).toBe('PHONE') // 11 dígitos que não são CPF válido
    expect(inferKeyType('123e4567-e89b-12d3-a456-426614174000')).toBe('RANDOM')
  })
  it('sem certeza: nenhum tipo', () => {
    expect(inferKeyType('qualquer coisa')).toBeNull()
    expect(inferKeyType('')).toBeNull()
  })
})

describe('parsePixForm', () => {
  const base = { key_type: 'CPF', key: '529.982.247-25', receiver_name: ' Luan Matos ', city: ' Manaus ' }
  it('valida, normaliza e apara', () => {
    expect(parsePixForm(base)).toEqual({ ok: true, value: { key_type: 'CPF', key: '52998224725', receiver_name: 'Luan Matos', city: 'Manaus' } })
  })
  it('nome e cidade vazios valem (reservas do backend)', () => {
    const r = parsePixForm({ ...base, receiver_name: '', city: '' })
    expect(r.ok).toBe(true)
  })
  it('erros por campo, com os limites do BR Code', () => {
    const r = parsePixForm({ key_type: 'CPF', key: '123', receiver_name: 'n'.repeat(26), city: 'c'.repeat(16) })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['city', 'key', 'receiver_name'])
      expect(r.errors.receiver_name).toBe('O nome vai até 25 caracteres.')
      expect(r.errors.city).toBe('A cidade vai até 15 caracteres.')
    }
  })
  it('conta letras, não bytes', () => {
    expect(parsePixForm({ ...base, receiver_name: 'ç'.repeat(25), city: 'ã'.repeat(15) }).ok).toBe(true)
  })
  it('tipo desconhecido', () => {
    const r = parsePixForm({ ...base, key_type: 'OUTRO' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.key_type).toBe('Escolha o tipo da chave.')
  })
})
