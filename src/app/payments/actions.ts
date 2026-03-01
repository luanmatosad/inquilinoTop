'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Função que gera pagamentos (mas não é server action direta de form)
export async function generateInitialPayments(leaseId: string, startDate: string, amount: number, paymentDay: number) {
  const supabase = await createClient()
  const payments = []
  
  // Vamos gerar os próximos 12 meses de pagamentos como padrão inicial
  const monthsToGenerate = 12
  
  // Converter input para datas
  const start = new Date(startDate)
  // Ajuste de fuso horário simples (considerando meio-dia para evitar virada de dia)
  start.setHours(12, 0, 0, 0)

  // Determinar o primeiro vencimento
  let currentMonth = start.getMonth()
  let currentYear = start.getFullYear()

  // Se o contrato começa dia 15 e o vencimento é dia 10, o primeiro aluguel cheio é no próximo mês (10/02)
  // (Ignorando pro-rata por enquanto para MVP)
  if (start.getDate() >= paymentDay) {
    currentMonth++
  }

  for (let i = 0; i < monthsToGenerate; i++) {
    // Criar data de vencimento
    const dueDate = new Date(currentYear, currentMonth + i, paymentDay, 12, 0, 0, 0)
    
    // Formatar descrição: "Aluguel Janeiro 2026"
    const monthName = dueDate.toLocaleString('pt-BR', { month: 'long' })
    const yearName = dueDate.getFullYear()
    const description = `Aluguel ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${yearName}`

    payments.push({
      lease_id: leaseId,
      description: description,
      amount: amount,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'PENDING',
      type: 'RENT'
    })
  }

  const { error } = await supabase.from('payments').insert(payments)

  if (error) {
    console.error('Erro ao gerar pagamentos iniciais:', error)
    return { error: error.message }
  }

  return { success: true }
}

export async function markAsPaid(paymentId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('payments')
    .update({ 
      status: 'PAID', 
      paid_at: new Date().toISOString() 
    })
    .eq('id', paymentId)

  if (error) {
    return { error: 'Erro ao marcar como pago: ' + error.message }
  }

  revalidatePath('/units/[id]', 'page') // Revalida onde a lista é usada (difícil saber o ID dinâmico aqui, então revalidamos tudo que der)
  return { success: true }
}

export async function markAsPending(paymentId: string) {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('payments')
      .update({ 
        status: 'PENDING', 
        paid_at: null 
      })
      .eq('id', paymentId)
  
    if (error) {
      return { error: 'Erro ao reabrir pagamento: ' + error.message }
    }
  
    return { success: true }
  }
