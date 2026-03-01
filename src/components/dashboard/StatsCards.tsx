import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building, Users, Home, Percent } from 'lucide-react'

interface StatsCardsProps {
  metrics: {
    totalProperties: number
    occupiedUnits: number
    totalUnits: number
    vacancyRate: number
    totalTenants: number
  }
}

export function StatsCards({ metrics }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Imóveis</CardTitle>
          <Building className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalProperties}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.totalUnits} unidades cadastradas
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Inquilinos Ativos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalTenants}</div>
          <p className="text-xs text-muted-foreground">
            +0 novos este mês (placeholder)
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unidades Ocupadas</CardTitle>
          <Home className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.occupiedUnits} / {metrics.totalUnits}</div>
          <p className="text-xs text-muted-foreground">
            Taxa de ocupação de {(100 - metrics.vacancyRate).toFixed(1)}%
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Vacância</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.vacancyRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            Unidades disponíveis
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
