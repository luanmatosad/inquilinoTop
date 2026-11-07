import { describe, it, expect } from 'vitest'
import {
  payExpenseSchema,
  payReceivableSchema,
  toPayExpensePayload,
  parseFilters,
  toQuery,
  expenseFormSchema,
  toExpensePayload,
  registerPaymentSchemaFor,
  toPaymentPayload,
  agreementSchemaFor,
  toAgreementPayload,
} from '@/lib/financial-schemas'

describe('payExpenseSchema', () => {
  it('exige a data de pagamento', () => {
    expect(payExpenseSchema.safeParse({}).success).toBe(false)
    expect(payExpenseSchema.safeParse({ paid_date: '15/06/2026' }).success).toBe(false)
    expect(payExpenseSchema.safeParse({ paid_date: '2026-06-15' }).success).toBe(true)
  })
  it('valor é opcional, mas deve ser positivo quando informado', () => {
    expect(payExpenseSchema.safeParse({ paid_date: '2026-06-15', paid_amount: '' }).success).toBe(true)
    expect(payExpenseSchema.safeParse({ paid_date: '2026-06-15', paid_amount: '149,99' }).success).toBe(true)
    for (const v of ['0', '-1', 'abc']) {
      expect(payExpenseSchema.safeParse({ paid_date: '2026-06-15', paid_amount: v }).success).toBe(false)
    }
  })
  it('payload usa RFC3339 e omite valor vazio', () => {
    expect(toPayExpensePayload({ paid_date: '2026-06-15', paid_amount: '' })).toEqual({ paid_date: '2026-06-15T00:00:00Z' })
    expect(toPayExpensePayload({ paid_date: '2026-06-15', paid_amount: '149,99' })).toEqual({
      paid_date: '2026-06-15T00:00:00Z',
      paid_amount: 149.99,
    })
  })
})

describe('payReceivableSchema', () => {
  it('exige a data', () => {
    expect(payReceivableSchema.safeParse({ paid_date: '' }).success).toBe(false)
    expect(payReceivableSchema.safeParse({ paid_date: '2026-06-15' }).success).toBe(true)
  })
})

describe('filtros', () => {
  const id = '5f0b6c1e-4f4a-4b5c-8e0a-1f2d3c4b5a69'
  it('ignora valores inválidos', () => {
    expect(parseFilters({ status: 'XYZ', from: 'ontem', to: '2026-13', ref: 'abc' })).toEqual({ to: undefined })
  })
  it('aceita valores válidos', () => {
    expect(parseFilters({ status: 'LATE', from: '2026-06-01', to: '2026-06-30', ref: id })).toEqual({
      status: 'LATE',
      from: '2026-06-01',
      to: '2026-06-30',
      ref: id,
    })
  })
  it('monta a query do backend com o parâmetro certo', () => {
    const f = { status: 'PENDING' as const, from: '2026-06-01', ref: id }
    expect(toQuery(f, 'unit_id')).toBe(`?status=PENDING&from=2026-06-01&unit_id=${id}`)
    expect(toQuery(f, 'lease_id', { withStatus: false })).toBe(`?from=2026-06-01&lease_id=${id}`)
    expect(toQuery({}, 'unit_id')).toBe('')
  })
})

describe('expenseFormSchema', () => {
  const UNIT = '5f0b6c1e-4f4a-4b5c-8e0a-1f2d3c4b5a69'
  const base = { description: 'Pintura da sala', unit_id: UNIT, category: 'MAINTENANCE', amount: '800,00', due_date: '2026-11-12' }
  it('aceita o mínimo', () => expect(expenseFormSchema.safeParse(base).success).toBe(true))
  it('descrição, unidade, valor e vencimento são obrigatórios', () => {
    expect(expenseFormSchema.safeParse({ ...base, description: '' }).success).toBe(false)
    expect(expenseFormSchema.safeParse({ ...base, unit_id: '' }).success).toBe(false)
    for (const v of ['', '0', '-1', 'abc']) expect(expenseFormSchema.safeParse({ ...base, amount: v }).success).toBe(false)
    expect(expenseFormSchema.safeParse({ ...base, due_date: '' }).success).toBe(false)
  })
  it('categoria só do enum', () => expect(expenseFormSchema.safeParse({ ...base, category: 'LIMPEZA' }).success).toBe(false))
  it('"já paguei" exige a data do pagamento', () => {
    const r = expenseFormSchema.safeParse({ ...base, paid: true })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.paid_date).toBeTruthy()
    expect(expenseFormSchema.safeParse({ ...base, paid: true, paid_date: '2026-11-02' }).success).toBe(true)
  })
  it('payload leva paid_date só quando já pago', () => {
    expect(toExpensePayload({ ...base, paid: false, paid_date: '2026-11-02' } as never).paid_date).toBeUndefined()
    const p = toExpensePayload({ ...base, paid: true, paid_date: '2026-11-02' } as never)
    expect(p).toMatchObject({ description: 'Pintura da sala', amount: 800, due_date: '2026-11-12T00:00:00Z', category: 'MAINTENANCE', paid_date: '2026-11-02T00:00:00Z' })
    expect(p).not.toHaveProperty('unit_id')
  })
})

describe('registerPaymentSchemaFor', () => {
  const base = { paid_date: '2026-11-02', payment_method: 'PIX' as const }
  const schema = registerPaymentSchemaFor(1850)

  it('aceita o mínimo e usa Pix por padrão no payload', () => {
    const r = schema.safeParse({ paid_date: '2026-11-02' })
    expect(r.success).toBe(true)
    if (r.success) expect(toPaymentPayload(r.data, 1850).payment_method).toBe('PIX')
  })
  it('exige a data', () => expect(schema.safeParse({ ...base, paid_date: '' }).success).toBe(false))
  it('forma só da lista', () => {
    expect(schema.safeParse({ ...base, payment_method: 'BITCOIN' }).success).toBe(false)
    for (const m of ['PIX', 'CASH', 'TRANSFER', 'BOLETO', 'OTHER']) expect(schema.safeParse({ ...base, payment_method: m }).success).toBe(true)
  })
  it('desconto: vazio ou zero ok, negativo, texto e acima do devido não', () => {
    expect(schema.safeParse({ ...base, discount_amount: '' }).success).toBe(true)
    expect(schema.safeParse({ ...base, discount_amount: '0' }).success).toBe(true)
    expect(schema.safeParse({ ...base, discount_amount: '50,00' }).success).toBe(true)
    expect(schema.safeParse({ ...base, discount_amount: '1850' }).success).toBe(true)
    for (const v of ['-1', 'abc', '1850,01']) expect(schema.safeParse({ ...base, discount_amount: v }).success).toBe(false)
  })
  it('observação até 500 caracteres', () => {
    expect(schema.safeParse({ ...base, payment_note: 'a'.repeat(500) }).success).toBe(true)
    expect(schema.safeParse({ ...base, payment_note: 'a'.repeat(501) }).success).toBe(false)
  })
  it('payload leva forma, desconto numérico e observação; omite vazios', () => {
    const r = schema.safeParse({ paid_date: '2026-11-02', payment_method: 'CASH', discount_amount: '50,00', payment_note: ' portaria ' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(toPaymentPayload(r.data, 1850)).toEqual({
        status: 'PAID', paid_date: '2026-11-02T00:00:00Z', gross_amount: 1850,
        payment_method: 'CASH', discount_amount: 50, payment_note: 'portaria',
      })
    }
    const v = schema.safeParse({ paid_date: '2026-11-02', payment_method: 'PIX', discount_amount: '', payment_note: '' })
    if (v.success) {
      const p = toPaymentPayload(v.data, 1850)
      expect(p).not.toHaveProperty('discount_amount')
      expect(p).not.toHaveProperty('payment_note')
    }
  })
})

describe('agreementSchemaFor', () => {
  const schema = agreementSchemaFor('2026-11-07')
  it('exige data posterior a hoje', () => {
    expect(schema.safeParse({ new_due_date: '2026-11-12', agreed_amount: '1585,13' }).success).toBe(true)
    for (const d of ['2026-11-07', '2026-11-01', '', 'x']) expect(schema.safeParse({ new_due_date: d, agreed_amount: '100' }).success).toBe(false)
  })
  it('valor maior que zero', () => {
    for (const v of ['', '0', '-5', 'abc']) expect(schema.safeParse({ new_due_date: '2026-11-12', agreed_amount: v }).success).toBe(false)
  })
  it('payload com data RFC3339, valor numérico e observação', () => {
    const r = schema.safeParse({ new_due_date: '2026-11-12', agreed_amount: '1585,13', note: 'WhatsApp' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(toAgreementPayload(r.data)).toEqual({ new_due_date: '2026-11-12T00:00:00Z', agreed_amount: 1585.13, note: 'WhatsApp' })
    }
  })
})
