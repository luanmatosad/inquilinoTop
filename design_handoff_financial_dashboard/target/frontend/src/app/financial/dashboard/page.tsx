import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Wallet,
  AlertTriangle,
  Building2,
  Send,
  Plus,
  Calendar,
} from 'lucide-react'

import { getDashboardMetrics, getReceivables } from '../actions'
import { KpiCard } from './_components/KpiCard'
import { CashFlowChart } from './_components/CashFlowChart'
import { OverdueList } from './_components/OverdueList'
import { fmtBRL, fmtBRLCompact } from '@/lib/format'

export default async function FinancialDashboard() {
  const metrics = await getDashboardMetrics()
  const receivables = await getReceivables()
  const overdue = receivables.filter((r) => r.status === 'OVERDUE').slice(0, 3)

  const now = new Date()
  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(now)
  const monthLabelShort = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(now)

  const realizedRatio =
    metrics.expectedRevenue > 0
      ? Math.round((metrics.realizedRevenue / metrics.expectedRevenue) * 100)
      : 0

  return (
    <div className="space-y-6">
      {/* ─── Header row ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Módulo financeiro · {monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="size-4" />
            {monthLabelShort.charAt(0).toUpperCase() + monthLabelShort.slice(1)}
          </Button>
          <Button size="sm">
            <Plus className="size-4" />
            Nova cobrança
          </Button>
        </div>
      </div>

      {/* ─── KPI grid ───────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Receita realizada"
          icon={Wallet}
          value={fmtBRL(metrics.realizedRevenue)}
          hint={`de ${fmtBRL(metrics.expectedRevenue)} previsto`}
          progress={realizedRatio}
        />
        <KpiCard
          title="Inadimplência"
          icon={AlertTriangle}
          accent={metrics.defaultRate > 5 ? 'danger' : 'success'}
          value={
            <span className={metrics.defaultRate > 5 ? 'text-destructive' : ''}>
              {metrics.defaultRate.toLocaleString('pt-BR', {
                maximumFractionDigits: 1,
              })}
              %
            </span>
          }
          hint={
            metrics.defaultRate > 5
              ? 'Acima do esperado'
              : 'Dentro do esperado'
          }
        />
        <KpiCard
          title="VGA — valor geral"
          icon={Building2}
          value={fmtBRLCompact(metrics.totalRentValue)}
          hint="Volume total de aluguéis geridos"
        />
        <KpiCard
          title="A repassar"
          icon={Send}
          value={fmtBRL(metrics.totalToTransfer)}
          hint="Para proprietários este mês"
        />
      </div>

      {/* ─── Chart + Aging ──────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 py-5">
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <h2 className="text-base font-semibold text-on-surface">
                  Fluxo de caixa
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Últimos 6 meses
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-on-surface-variant">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] bg-primary" />
                  Receita
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] bg-chart-2" />
                  Despesa
                </span>
              </div>
            </div>
            <CashFlowChart />
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardContent className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-on-surface">
                Aging de contas
              </h2>
              <p className="text-xs text-on-surface-variant">
                Inquilinos em atraso
              </p>
            </div>
            <OverdueList items={overdue} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
