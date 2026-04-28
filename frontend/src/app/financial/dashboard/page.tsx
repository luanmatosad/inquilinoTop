import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardMetrics, getReceivables } from '../actions';
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default async function FinancialDashboard() {
  const metrics = await getDashboardMetrics();
  const receivables = await getReceivables();
  const overdue = receivables.filter(r => r.status === 'OVERDUE').slice(0, 3);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Visão Geral</h1>
          <p className="text-on-surface-variant">Módulo Financeiro - Mês Atual</p>
        </div>
        <div>
          <input type="month" className="px-4 py-2 bg-surface border border-outline rounded-md text-sm text-on-surface" defaultValue="2026-05" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Prevista vs. Realizada</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(metrics.realizedRevenue)}</div>
            <p className="text-xs text-on-surface-variant">de {formatBRL(metrics.expectedRevenue)} previsto</p>
            <div className="mt-4 h-2 w-full bg-surface-variant rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary" 
                style={{ width: `${(metrics.realizedRevenue / (metrics.expectedRevenue || 1)) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Inadimplência</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${metrics.defaultRate > 5 ? 'text-error' : 'text-success'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-error">{metrics.defaultRate}%</div>
            <p className="text-xs text-on-surface-variant">
              {metrics.defaultRate > 5 ? 'Acima do ideal' : 'Dentro do esperado'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Geral de Aluguel (VGA)</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(metrics.totalRentValue)}</div>
            <p className="text-xs text-on-surface-variant">Volume total de aluguéis geridos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Repassar</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(metrics.totalToTransfer)}</div>
            <p className="text-xs text-on-surface-variant">Para proprietários este mês</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-7">
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Fluxo de Caixa (6 Meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-end justify-between space-x-2 pt-4">
              {/* Placeholder for chart */}
              {[40, 60, 45, 80, 55, 90].map((h, i) => (
                <div key={i} className="w-full flex flex-col justify-end gap-1 group relative">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-surface text-on-surface text-xs p-1 rounded shadow-sm whitespace-nowrap transition-opacity z-10 border border-outline">
                    {formatBRL(h * 1000)}
                  </div>
                  <div className="bg-primary/20 hover:bg-primary/40 rounded-t-sm w-full transition-colors" style={{ height: `${h}%` }}></div>
                  <div className="text-center text-xs text-on-surface-variant mt-2">Mês {i+1}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Aging de Contas</CardTitle>
            <p className="text-sm text-on-surface-variant">Inquilinos em atraso</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {overdue.length === 0 ? (
                <div className="text-sm text-center py-4 text-on-surface-variant">Nenhum atraso registrado</div>
              ) : overdue.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-outline pb-2 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{item.payer}</p>
                    <p className="text-xs text-on-surface-variant">
                      {item.property}
                    </p>
                    <p className="text-xs font-semibold text-error">
                      {formatBRL(item.amount)}
                    </p>
                  </div>
                  <button className="text-xs px-3 py-1 bg-[#25D366]/10 text-[#25D366] rounded-full hover:bg-[#25D366]/20 transition-colors font-medium">
                    Cobrar
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}