'use server'

import { revalidatePath } from 'next/cache'
import { goFetch } from '@/lib/go/server-auth'
import { FinancialConfig, UpsertFinancialConfigInput, BankInfo } from '@/types'

export async function getFinancialConfig(): Promise<FinancialConfig | null> {
  try {
    const data = await goFetch<FinancialConfig | null>('/api/v1/payments/config')
    return data
  } catch (error) {
    console.error('Error fetching financial config:', error)
    return null
  }
}

export async function updateFinancialConfig(prevState: any, formData: FormData) {
  try {
    const provider = formData.get('provider') as string
    const pixKey = (formData.get('pix_key') as string) || null
    const defaultLateFee = formData.get('default_late_fee') as string
    const defaultInterest = formData.get('default_interest') as string

    // For BankInfo
    const bankCode = formData.get('bank_code') as string
    const agency = formData.get('agency') as string
    const account = formData.get('account') as string
    const accountType = formData.get('account_type') as 'CC' | 'CP'
    const ownerName = formData.get('owner_name') as string
    const document = formData.get('document') as string

    const config: Record<string, any> = {}
    if (defaultLateFee) config['default_late_fee'] = parseFloat(defaultLateFee)
    if (defaultInterest) config['default_interest'] = parseFloat(defaultInterest)
    
    // Add provider API keys if present
    const asaasApiKey = formData.get('asaas_api_key') as string
    if (asaasApiKey) config['api_key'] = asaasApiKey

    let bankInfo: BankInfo | null = null
    if (bankCode && agency && account && accountType && ownerName && document) {
      bankInfo = {
        bank_code: bankCode,
        agency,
        account,
        account_type: accountType,
        owner_name: ownerName,
        document
      }
    }

    const input: UpsertFinancialConfigInput = {
      provider: provider || 'MOCK',
      config,
      pix_key: pixKey,
      bank_info: bankInfo,
    }

    const data = await goFetch<FinancialConfig>('/api/v1/payments/config', {
      method: 'PUT',
      body: JSON.stringify(input),
    })

    revalidatePath('/settings/financial')

    return { success: 'Configurações financeiras salvas com sucesso!', config: data }
  } catch (error) {
    console.error('Error updating financial config:', error)
    return { error: error instanceof Error ? error.message : 'Erro ao salvar configurações.' }
  }
}
