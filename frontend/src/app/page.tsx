import { redirect } from 'next/navigation'
import { getDashboardMetrics } from '@/data/dashboard/dal'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { FinancialSummary } from '@/components/dashboard/FinancialSummary'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (!accessToken) {
    redirect('/login')
  }

  const metrics = await getDashboardMetrics()

  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Dashboard</h1>
        <p className="text-base text-on-surface-variant">
          Visão geral dos seus imóveis e finanças deste mês.
        </p>
      </div>

      <StatsCards metrics={metrics} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 lg:col-span-4">
          <FinancialSummary revenue={metrics.monthlyRevenue} />
        </div>
        <div className="col-span-4 lg:col-span-3">
          <RecentActivity 
            payments={metrics.recentPayments} 
            expiringLeases={metrics.expiringLeases} 
          />
        </div>
      </div>
    </div>
  )
}