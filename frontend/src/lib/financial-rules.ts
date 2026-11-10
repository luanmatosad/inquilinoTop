// Regras financeiras da organização (spec financial-rules): padrões para novos contratos e janela do aviso de reajuste.
// Os limites repetem os do backend (`internal/settings`); lá é que valem de verdade.
export type AdjustmentIndex = 'IGP-M' | 'IPCA'

export type FinancialRules = {
  late_fee_percent: number
  monthly_interest_percent: number
  default_adjustment_index: AdjustmentIndex
  readjust_notice_days: number
}

export const DEFAULT_RULES: FinancialRules = { late_fee_percent: 2, monthly_interest_percent: 1, default_adjustment_index: 'IGP-M', readjust_notice_days: 60 }

export const RULE_LIMITS = { lateFee: 10, interest: 5, noticeMin: 1, noticeMax: 180 } as const

export type RulesFormInput = {
  late_fee_percent: string
  monthly_interest_percent: string
  default_adjustment_index: string
  readjust_notice_days: string
}

export type RulesParseResult = { ok: true; value: FinancialRules } | { ok: false; errors: Partial<Record<keyof FinancialRules, string>> }

/** "2,5" ou "2.5" → 2.5; vazio ou texto → NaN. */
function decimal(s: string): number {
  const t = s.trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}

export function parseRulesForm(raw: RulesFormInput): RulesParseResult {
  const errors: Partial<Record<keyof FinancialRules, string>> = {}
  const late = decimal(raw.late_fee_percent)
  const interest = decimal(raw.monthly_interest_percent)
  const days = /^\d+$/.test(raw.readjust_notice_days.trim()) ? Number(raw.readjust_notice_days.trim()) : NaN
  const index = raw.default_adjustment_index

  if (!(late >= 0 && late <= RULE_LIMITS.lateFee)) errors.late_fee_percent = `A multa vai de 0 a ${RULE_LIMITS.lateFee}%.`
  if (!(interest >= 0 && interest <= RULE_LIMITS.interest)) errors.monthly_interest_percent = `Os juros vão de 0 a ${RULE_LIMITS.interest}% ao mês.`
  if (index !== 'IGP-M' && index !== 'IPCA') errors.default_adjustment_index = 'Escolha IGP-M ou IPCA.'
  if (!(days >= RULE_LIMITS.noticeMin && days <= RULE_LIMITS.noticeMax)) errors.readjust_notice_days = `O aviso vai de ${RULE_LIMITS.noticeMin} a ${RULE_LIMITS.noticeMax} dias (número inteiro).`

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { late_fee_percent: late, monthly_interest_percent: interest, default_adjustment_index: index as AdjustmentIndex, readjust_notice_days: days } }
}

const asText = (n: number) => (n === 0 ? '' : String(n).replace('.', ','))

/** Valores iniciais do formulário de **novo** contrato. Sem as regras: 2%, 1% e nenhum índice (como era antes). */
export function contractDefaults(rules: FinancialRules | null) {
  if (!rules) return { late_fee_percent: '2', monthly_interest_percent: '1', adjustment_index: '' as '' | AdjustmentIndex }
  return {
    late_fee_percent: asText(rules.late_fee_percent),
    monthly_interest_percent: asText(rules.monthly_interest_percent),
    adjustment_index: rules.default_adjustment_index as '' | AdjustmentIndex,
  }
}

/** Dias de aviso do reajuste em Hoje: o das regras, ou 60 se não deu para ler. */
export const noticeDaysOf = (rules: FinancialRules | null) => rules?.readjust_notice_days ?? DEFAULT_RULES.readjust_notice_days

export function rulesErrorMessage(code?: string): string {
  if (code === 'INVALID_RULES') return 'Confira os valores: multa de 0 a 10%, juros de 0 a 5%, índice IGP-M ou IPCA e aviso de 1 a 180 dias.'
  return 'Erro ao salvar as regras.'
}
