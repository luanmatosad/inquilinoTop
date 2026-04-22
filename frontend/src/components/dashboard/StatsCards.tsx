import { Card } from '@heroui/react'
import { Building2, Users, Home, Percent, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react'

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
  const occupancyRate = 100 - metrics.vacancyRate

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Imóveis */}
      <Card className="p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
        <div className="flex items-center gap-2 text-outline mb-2">
          <Building2 className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-outline">Total Imóveis</span>
        </div>
        <div className="text-3xl font-bold text-on-surface">{metrics.totalProperties}</div>
        <div className="flex items-center gap-1 mt-2 text-xs text-tertiary">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-primary">+2 este mês</span>
        </div>
      </Card>

      {/* Inquilinos Ativos */}
      <Card className="p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-secondary-container" />
        <div className="flex items-center gap-2 text-outline mb-2">
          <Users className="w-5 h-5 text-secondary-container" />
          <span className="text-sm font-medium text-outline">Inquilinos Ativos</span>
        </div>
        <div className="text-3xl font-bold text-on-surface">{metrics.totalTenants}</div>
        <div className="flex items-center gap-1 mt-2 text-xs text-tertiary">
          <CheckCircle className="w-4 h-4 text-outline" />
          <span>90% contratos regulares</span>
        </div>
      </Card>

      {/* Unidades Ocupadas */}
      <Card className="p-4 relative overflow-hidden">
        <div className="flex items-center gap-2 text-outline mb-2">
          <Home className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-outline">Unidades Ocupadas</span>
        </div>
        <div className="text-3xl font-bold text-on-surface">
          {metrics.occupiedUnits} <span className="text-xl text-outline">/ {metrics.totalUnits}</span>
        </div>
        <div className="w-full bg-surface-container h-2 rounded-full mt-2 overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full" 
            style={{ width: `${occupancyRate}%` }} 
          />
        </div>
      </Card>

      {/* Taxa de Vacância */}
      <Card className="p-4 relative overflow-hidden">
        <div className="flex items-center gap-2 text-outline mb-2">
          <Percent className="w-5 h-5 text-error" />
          <span className="text-sm font-medium text-outline">Taxa de Vacância</span>
        </div>
        <div className="text-3xl font-bold text-on-surface">{metrics.vacancyRate.toFixed(1)}%</div>
        <div className="flex items-center gap-1 mt-2 text-xs text-tertiary">
          <TrendingDown className="w-4 h-4 text-error" />
          <span className="text-error">-1.2% vs mês ant.</span>
        </div>
      </Card>
    </div>
  )
}