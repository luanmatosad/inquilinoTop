'use server'

import { revalidatePath } from 'next/cache'

import { goFetch } from '@/lib/go/client'
import { goErrorInfo } from '@/lib/go/errors'
import { todaySaoPaulo } from '@/lib/lease-overview'
import { parseAmount, reportSchemaFor, validateProof } from '@/lib/public-charge'

export type ReportResponse = { success: true } | { error: string }

const ERRORS: Record<string, string> = {
  NOT_FOUND: 'Este link não vale mais. Peça um novo a quem enviou a cobrança.',
  ALREADY_PAID: 'Esta cobrança já está paga.',
  INVALID_REPORT: 'Informe um valor maior que zero.',
  INVALID_PAID_DATE: 'A data do pagamento não pode ser futura nem ter mais de 60 dias.',
  PROOF_TOO_LARGE: 'O comprovante deve ter até 5 MB.',
  PROOF_TYPE_NOT_ALLOWED: 'Envie uma foto (JPEG ou PNG) ou um PDF.',
  RATE_LIMIT_EXCEEDED: 'Muitas tentativas. Tente de novo mais tarde.',
}

/** "Já paguei": valida de novo no servidor (o navegador não é confiável) e repassa ao backend sem credenciais. */
export async function reportPayment(token: string, formData: FormData): Promise<ReportResponse> {
  const amount = String(formData.get('amount') ?? '')
  const paid_date = String(formData.get('paid_date') ?? '')
  const parsed = reportSchemaFor(todaySaoPaulo()).safeParse({ amount, paid_date })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Confira os campos.' }

  const proof = formData.get('proof')
  const file = proof instanceof File && proof.size > 0 ? proof : null
  const proofError = validateProof(file)
  if (proofError) return { error: proofError }

  const body = new FormData()
  body.set('amount', String(parseAmount(amount)))
  body.set('paid_date', paid_date)
  if (file) body.set('proof', file, file.name)

  try {
    await goFetch(`/api/v1/public/payments/${encodeURIComponent(token)}/report`, { method: 'POST', body, skipAuth: true })
    revalidatePath(`/p/${token}`)
    return { success: true }
  } catch (error) {
    const { code } = goErrorInfo(error)
    if (code && ERRORS[code]) return { error: ERRORS[code] }
    console.error('Erro ao avisar pagamento:', error)
    return { error: 'Não foi possível enviar o aviso agora. Tente de novo.' }
  }
}
