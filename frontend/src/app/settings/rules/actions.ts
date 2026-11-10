'use server'

import { revalidatePath } from 'next/cache'

import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import { parseRulesForm, rulesErrorMessage, type FinancialRules, type RulesFormInput } from '@/lib/financial-rules'

export type SaveRulesResult = { success: true; rules: FinancialRules } | { error: string; fieldErrors?: Partial<Record<keyof FinancialRules, string>> }

/** Valida no servidor (mesmas faixas do backend) e grava as regras. Só o dono da conta pode alterar. */
export async function saveFinancialRules(input: RulesFormInput): Promise<SaveRulesResult> {
  const parsed = parseRulesForm(input)
  if (!parsed.ok) return { error: 'Confira os campos.', fieldErrors: parsed.errors }
  try {
    const rules = await goFetch<FinancialRules>('/api/v1/settings/financial-rules', { method: 'PUT', body: JSON.stringify(parsed.value) })
    revalidatePath('/settings/rules')
    revalidatePath('/leases')
    revalidatePath('/')
    return { success: true, rules }
  } catch (error) {
    const { code, status } = goErrorInfo(error)
    if (status === 403) return { error: 'Só o dono da conta pode alterar as regras financeiras.' }
    console.error('Erro ao salvar as regras financeiras:', error)
    return { error: rulesErrorMessage(code) }
  }
}
