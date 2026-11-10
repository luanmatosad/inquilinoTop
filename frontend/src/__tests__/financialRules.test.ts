import { describe, it, expect } from 'vitest'
import { DEFAULT_RULES, parseRulesForm, contractDefaults, noticeDaysOf, rulesErrorMessage } from '@/lib/financial-rules'

const ok = { late_fee_percent: '2,5', monthly_interest_percent: '1', default_adjustment_index: 'IPCA', readjust_notice_days: '45' }

describe('parseRulesForm', () => {
  it('aceita vírgula ou ponto e devolve números', () => {
    expect(parseRulesForm(ok)).toEqual({ ok: true, value: { late_fee_percent: 2.5, monthly_interest_percent: 1, default_adjustment_index: 'IPCA', readjust_notice_days: 45 } })
    const r = parseRulesForm({ ...ok, late_fee_percent: '3.25' })
    expect(r.ok && r.value.late_fee_percent).toBe(3.25)
  })
  it('limites valem (0 e máximos)', () => {
    expect(parseRulesForm({ late_fee_percent: '0', monthly_interest_percent: '0', default_adjustment_index: 'IGP-M', readjust_notice_days: '1' }).ok).toBe(true)
    expect(parseRulesForm({ late_fee_percent: '10', monthly_interest_percent: '5', default_adjustment_index: 'IGP-M', readjust_notice_days: '180' }).ok).toBe(true)
  })
  it('erros por campo, nas faixas do backend', () => {
    const r = parseRulesForm({ late_fee_percent: '10,5', monthly_interest_percent: '8', default_adjustment_index: 'SELIC', readjust_notice_days: '0' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toEqual({
        late_fee_percent: 'A multa vai de 0 a 10%.',
        monthly_interest_percent: 'Os juros vão de 0 a 5% ao mês.',
        default_adjustment_index: 'Escolha IGP-M ou IPCA.',
        readjust_notice_days: 'O aviso vai de 1 a 180 dias (número inteiro).',
      })
    }
  })
  it('vazio, texto e decimal no aviso são recusados', () => {
    for (const bad of [{ late_fee_percent: '' }, { late_fee_percent: 'abc' }, { monthly_interest_percent: '-1' }, { readjust_notice_days: '2,5' }, { readjust_notice_days: '' }, { readjust_notice_days: '181' }]) {
      expect(parseRulesForm({ ...ok, ...bad }).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('contractDefaults / noticeDaysOf', () => {
  it('sem regras: os padrões fixos de sempre (2, 1, sem índice)', () => {
    expect(contractDefaults(null)).toEqual({ late_fee_percent: '2', monthly_interest_percent: '1', adjustment_index: '' })
  })
  it('com regras: texto no formato do formulário (vírgula; zero vira vazio)', () => {
    expect(contractDefaults({ late_fee_percent: 2.5, monthly_interest_percent: 0, default_adjustment_index: 'IPCA', readjust_notice_days: 60 })).toEqual({
      late_fee_percent: '2,5',
      monthly_interest_percent: '',
      adjustment_index: 'IPCA',
    })
  })
  it('dias do aviso: das regras, ou 60 sem elas', () => {
    expect(noticeDaysOf(null)).toBe(60)
    expect(noticeDaysOf({ ...DEFAULT_RULES, readjust_notice_days: 45 })).toBe(45)
  })
})

describe('rulesErrorMessage', () => {
  it('traduz INVALID_RULES e cai numa mensagem geral', () => {
    expect(rulesErrorMessage('INVALID_RULES')).toMatch(/multa de 0 a 10/i)
    expect(rulesErrorMessage('OUTRO')).toBe('Erro ao salvar as regras.')
    expect(rulesErrorMessage(undefined)).toBe('Erro ao salvar as regras.')
  })
})
