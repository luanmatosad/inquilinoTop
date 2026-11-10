'use client'

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { monthShort, type MonthRow } from '@/lib/report-overview'
import { formatCurrency } from '@/lib/utils'

const config = {
  received: { label: 'Recebido', color: 'var(--primary)' },
  expenses: { label: 'Despesas', color: 'var(--warning)' },
} satisfies ChartConfig

/** Barras de Recebido e Despesas por mês. A tabela escondida dá a mesma informação a leitores de tela. */
export function MonthlyChart({ months }: { months: MonthRow[] }) {
  const data = months.map((m) => ({ ...m, label: monthShort(m.month) }))
  return (
    <>
      <ChartContainer config={config} className="h-64 w-full" role="img" aria-label="Recebido e despesas por mês">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="received" fill="var(--color-received)" radius={4} />
          <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>Recebido e despesas por mês</caption>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Recebido</th>
            <th>Despesas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.month}>
              <td>{m.label}</td>
              <td>{formatCurrency(m.received)}</td>
              <td>{formatCurrency(m.expenses)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
