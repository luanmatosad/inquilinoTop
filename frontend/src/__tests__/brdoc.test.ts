import { describe, it, expect } from 'vitest'
import { isValidCpf, isValidCnpj, isValidDocument } from '@/lib/br-doc'
import { maskCpfCnpj, maskCep, maskPhone, onlyDigits } from '@/lib/masks'

describe('br-doc', () => {
  it('valida CPF com e sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })
  it('rejeita CPF inválido', () => {
    expect(isValidCpf('52998224726')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
    expect(isValidCpf('')).toBe(false)
  })
  it('valida CNPJ', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000182')).toBe(false)
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false)
  })
  it('isValidDocument escolhe por tipo de pessoa', () => {
    expect(isValidDocument('PF', '52998224725')).toBe(true)
    expect(isValidDocument('PF', '11222333000181')).toBe(false)
    expect(isValidDocument('PJ', '11222333000181')).toBe(true)
    expect(isValidDocument('PJ', '52998224725')).toBe(false)
  })
})

describe('masks', () => {
  it('onlyDigits', () => {
    expect(onlyDigits('529.982.247-25')).toBe('52998224725')
    expect(onlyDigits(undefined)).toBe('')
  })
  it('maskCpfCnpj aplica CPF até 11 dígitos e CNPJ acima', () => {
    expect(maskCpfCnpj('52998224725')).toBe('529.982.247-25')
    expect(maskCpfCnpj('529982')).toBe('529.982')
    expect(maskCpfCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(maskCpfCnpj('112223330001819999')).toBe('11.222.333/0001-81')
  })
  it('maskCep', () => {
    expect(maskCep('01310100')).toBe('01310-100')
    expect(maskCep('0131')).toBe('0131')
    expect(maskCep('013101009')).toBe('01310-100')
  })
  it('maskPhone fixo e celular', () => {
    expect(maskPhone('11999998888')).toBe('(11) 99999-8888')
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444')
    expect(maskPhone('11')).toBe('(11')
  })
})
