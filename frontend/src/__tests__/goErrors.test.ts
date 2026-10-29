import { describe, it, expect } from 'vitest'
import { goErrorInfo } from '@/lib/go/errors'

describe('goErrorInfo', () => {
  it('lê code e status anexados pelo goFetch', () => {
    const err = Object.assign(new Error('já existe'), { code: 'DUPLICATE_DOCUMENT', status: 409 })
    expect(goErrorInfo(err)).toEqual({ code: 'DUPLICATE_DOCUMENT', status: 409, message: 'já existe' })
  })
  it('usa fallback para valores que não são Error', () => {
    expect(goErrorInfo('x', 'falhou').message).toBe('falhou')
  })
})
