import { createClient } from '@/lib/supabase/server'

export interface DashboardMetrics {
  totalProperties: number
  totalUnits: number
  occupiedUnits: number
  vacancyRate: number
  totalTenants: number
  monthlyRevenue: {
    total: number
    paid: number
    pending: number
    overdue: number
  }
  recentPayments: {
    id: string
    description: string
    amount: number
    due_date: string
    status: string
    tenantName: string
  }[]
  expiringLeases: {
    id: string
    unitLabel: string
    tenantName: string
    endDate: string
  }[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient()

  // 1. Buscas Paralelas para otimização
  const [
    { count: totalProperties },
    { data: units },
    { count: totalTenants },
    { data: payments },
    { data: expiringLeases }
  ] = await Promise.all([
    supabase.from('properties').select('*', { count: 'exact', head: true }),
    supabase.from('units').select('id, is_active, leases(status)'),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('is_active', true),
    
    // Pagamentos do mês atual
    supabase.from('payments')
      .select(`
        id, description, amount, due_date, status, paid_at,
        lease:leases(tenant:tenants(name))
      `)
      .gte('due_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .lte('due_date', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString())
      .order('due_date', { ascending: true }),

    // Contratos vencendo nos próximos 30 dias
    supabase.from('leases')
      .select(`
        id, end_date,
        unit:units(label),
        tenant:tenants(name)
      `)
      .eq('status', 'ACTIVE')
      .not('end_date', 'is', null)
      .lte('end_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
      .gte('end_date', new Date().toISOString())
      .order('end_date', { ascending: true })
      .limit(5)
  ])

  // 2. Processamento dos dados
  
  // Ocupação
  const totalUnits = units?.length || 0
  const occupiedUnits = units?.filter(u => 
    u.leases && u.leases.some((l: any) => l.status === 'ACTIVE')
  ).length || 0
  
  const vacancyRate = totalUnits > 0 
    ? ((totalUnits - occupiedUnits) / totalUnits) * 100 
    : 0

  // Financeiro
  const monthlyRevenue = {
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0
  }

  const today = new Date().toISOString().split('T')[0]

  payments?.forEach((p: any) => {
    const amount = Number(p.amount)
    monthlyRevenue.total += amount

    if (p.status === 'PAID') {
      monthlyRevenue.paid += amount
    } else if (p.status === 'PENDING') {
      if (p.due_date < today) {
        monthlyRevenue.overdue += amount
      } else {
        monthlyRevenue.pending += amount
      }
    }
  })

  // Recentes (últimos 5 pagamentos ou próximos 5 a vencer)
  const recentPayments = payments?.slice(0, 5).map((p: any) => ({
    id: p.id,
    description: p.description,
    amount: Number(p.amount),
    due_date: p.due_date,
    status: p.due_date < today && p.status === 'PENDING' ? 'LATE' : p.status,
    tenantName: p.lease?.tenant?.name || 'Desconhecido'
  })) || []

  // Leases vencendo
  const formattedExpiringLeases = expiringLeases?.map((l: any) => ({
    id: l.id,
    unitLabel: l.unit?.label || 'Unidade',
    tenantName: l.tenant?.name || 'Inquilino',
    endDate: l.end_date
  })) || []

  return {
    totalProperties: totalProperties || 0,
    totalUnits,
    occupiedUnits,
    vacancyRate,
    totalTenants: totalTenants || 0,
    monthlyRevenue,
    recentPayments,
    expiringLeases: formattedExpiringLeases
  }
}
