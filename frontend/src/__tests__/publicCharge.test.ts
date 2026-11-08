import { describe, it, expect } from 'vitest'

import {
  MAX_PROOF_BYTES,
  chargeTitle,
  firstName,
  initials,
  reportSchemaFor,
  validateProof,
} from '@/lib/public-charge'

const TODAY = '2026-11-07'
const schema = reportSchemaFor(TODAY)

describe('reportSchemaFor', () => {
  it('aceita valor e data de hoje', () => {
    expect(schema.safeParse({ amount: '1.850,00', paid_date: '2026-11-07' }).success).toBe(true)
    expect(schema.safeParse({ amount: '1850.00', paid_date: '2026-11-02' }).success).toBe(true)
  })

  it('recusa valor zero, vazio ou ilegível', () => {
    for (const amount of ['0', '', 'abc', '-5']) {
      const r = schema.safeParse({ amount, paid_date: TODAY })
      expect(r.success, amount).toBe(false)
    }
  })

  it('recusa data futura e data com mais de 60 dias', () => {
    const future = schema.safeParse({ amount: '10', paid_date: '2026-11-08' })
    expect(future.success).toBe(false)
    const old = schema.safeParse({ amount: '10', paid_date: '2026-09-07' })
    expect(old.success).toBe(false)
    const limit = schema.safeParse({ amount: '10', paid_date: '2026-09-08' })
    expect(limit.success).toBe(true)
  })

  it('recusa data malformada', () => {
    expect(schema.safeParse({ amount: '10', paid_date: 'ontem' }).success).toBe(false)
  })
})

describe('validateProof', () => {
  const file = (size: number, type: string) => ({ size, type })

  it('sem arquivo é válido (comprovante é opcional)', () => {
    expect(validateProof(null)).toBeNull()
  })

  it('aceita JPEG, PNG e PDF até 5 MB', () => {
    for (const t of ['image/jpeg', 'image/png', 'application/pdf']) {
      expect(validateProof(file(1024, t)), t).toBeNull()
    }
    expect(validateProof(file(MAX_PROOF_BYTES, 'image/png'))).toBeNull()
  })

  it('recusa arquivo grande e tipo não permitido', () => {
    expect(validateProof(file(MAX_PROOF_BYTES + 1, 'image/png'))).toMatch(/5 MB/)
    expect(validateProof(file(10, 'text/html'))).toMatch(/foto|PDF/i)
    expect(validateProof(file(0, 'image/png'))).toMatch(/vazio/i)
  })
})

describe('textos', () => {
  it('título da cobrança pela competência', () => {
    expect(chargeTitle({ competency: '2026-11' })).toBe('Aluguel de novembro')
    expect(chargeTitle({ description: 'IPTU 2026' })).toBe('IPTU 2026')
    expect(chargeTitle({})).toBe('Cobrança de aluguel')
  })

  it('primeiro nome e iniciais', () => {
    expect(firstName('Luan Matos')).toBe('Luan')
    expect(firstName('')).toBe('o locador')
    expect(initials('Luan Matos')).toBe('LM')
    expect(initials('Luan')).toBe('L')
    expect(initials('')).toBe('?')
  })
})
