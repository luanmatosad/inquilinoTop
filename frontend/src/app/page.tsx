import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AlertCircle } from 'lucide-react'
import { getDashboardMetrics, type DashboardMetrics } from '@/data/dashboard/dal'
import { classifyDashboardError, type DashboardErrorKind } from '@/data/dashboard/mapper'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { FinancialSummary } from '@/components/dashboard/FinancialSummary'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

async function DashboardMetricsSection() {
  let metrics: DashboardMetrics
  try {
    metrics = await getDashboardMetrics()
  } catch (error) {
    const kind = classifyDashboardError(error)
    if (kind === 'unauthorized') {
      redirect('/login')
    }
    return <DashboardError kind={kind} />
  }

  return (
    <div className="space-y-6">
      <StatsCards metrics={metrics} />

      <div className="grid gap-4 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <FinancialSummary revenue={metrics.monthlyRevenue} />
        </div>
        <div className="lg:col-span-3">
          <RecentActivity payments={metrics.recentPayments} expiringLeases={metrics.expiringLeases} />
        </div>
      </div>
    </div>
  )
}

const ERROR_MESSAGES: Record<DashboardErrorKind, { title: string; description: string; retry: boolean }> = {
  unauthorized: { title: 'Sessão expirada', description: 'Entre novamente para continuar.', retry: false },
  no_org: {
    title: 'Conta sem organização',
    description: 'Sua conta ainda não está vinculada a uma organização. Entre em contato com o suporte.',
    retry: false,
  },
  forbidden: {
    title: 'Sem permissão',
    description: 'Seu perfil não tem acesso ao painel. Fale com o administrador da sua organização.',
    retry: false,
  },
  server: { title: 'Não foi possível carregar o painel', description: 'Tente novamente em instantes.', retry: true },
}

function DashboardError({ kind }: { kind: DashboardErrorKind }) {
  const { title, description, retry } = ERROR_MESSAGES[kind]
  return (
    <Card role="alert">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {retry && (
          <Button variant="outline" asChild>
            <Link href="/">Tentar novamente</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (!accessToken) {
    redirect('/login')
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral dos seus imóveis e finanças deste mês.</p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardMetricsSection />
      </Suspense>
    </div>
  )
}
