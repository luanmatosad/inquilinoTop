import { describe, it, expect } from 'vitest'
import { validateContractFile, MAX_DOCUMENT_BYTES } from '@/lib/lease-document'

describe('validateContractFile', () => {
  it('aceita pdf, doc e docx até 10 MB', () => {
    for (const n of ['a.pdf', 'a.DOC', 'a.docx']) expect(validateContractFile({ name: n, size: 1000 })).toBeNull()
    expect(validateContractFile({ name: 'a.pdf', size: MAX_DOCUMENT_BYTES })).toBeNull()
  })
  it('recusa outros tipos, acima de 10 MB e vazio', () => {
    expect(validateContractFile({ name: 'a.png', size: 10 })).toMatch(/PDF/)
    expect(validateContractFile({ name: 'a.pdf', size: MAX_DOCUMENT_BYTES + 1 })).toMatch(/10 MB/)
    expect(validateContractFile({ name: 'a.pdf', size: 0 })).toMatch(/vazio/)
  })
})
