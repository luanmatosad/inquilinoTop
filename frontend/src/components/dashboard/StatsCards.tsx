import type { ReactNode } from 'react'
import { Building2, Home, Percent, Users, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatsCardsProps {
  metrics: {
    totalProperties: number
    occupiedUnits: number
    totalUnits: number
    vacancyRate: number
    totalTenants: number
  }
}

interface StatCardProps {
  title: string
  icon: LucideIcon
  iconClassName?: string
  value: ReactNode
}

function StatCard({ title, icon: Icon, iconClassName, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{title}</CardDescription>
        <Icon className={cn('size-4 text-muted-foreground', iconClassName)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  )
}

export function StatsCards({ metrics }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total Imóveis" icon={Building2} iconClassName="text-primary" value={metrics.totalProperties} />

      <StatCard title="Inquilinos Ativos" icon={Users} value={metrics.totalTenants} />

      <StatCard
        title="Unidades Ocupadas"
        icon={Home}
        iconClassName="text-primary"
        value={
          <>
            {metrics.occupiedUnits}{' '}
            <span className="text-xl font-normal text-muted-foreground">/ {metrics.totalUnits}</span>
          </>
        }
      />

      <StatCard
        title="Taxa de Vacância"
        icon={Percent}
        iconClassName="text-destructive"
        value={`${metrics.vacancyRate.toFixed(1)}%`}
      />
    </div>
  )
}
