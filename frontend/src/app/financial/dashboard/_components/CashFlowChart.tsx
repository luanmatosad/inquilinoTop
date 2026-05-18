'use client'

import * as React from 'react'
import { fmtBRL } from '@/lib/format'

interface Point {
  month: string
  receita: number
  despesa: number
}

// TODO(api): replace with real series from getCashFlowSeries() server action.
// Values are in BRL × 1.000 so the data matches the dashboard mock.
const SERIES: Point[] = [
  { month: 'Dez', receita: 82_000, despesa: 58_000 },
  { month: 'Jan', receita: 95_000, despesa: 62_000 },
  { month: 'Fev', receita: 88_000, despesa: 64_000 },
  { month: 'Mar', receita: 110_000, despesa: 71_000 },
  { month: 'Abr', receita: 96_000, despesa: 60_000 },
  { month: 'Mai', receita: 128_000, despesa: 74_000 },
]

export function CashFlowChart({ data = SERIES }: { data?: Point[] }) {
  const max = Math.max(
    140_000,
    ...data.flatMap((d) => [d.receita, d.despesa]),
  )

  return (
    <div className="flex h-[220px] items-end justify-between gap-4 px-2">
      {data.map((d) => (
        <div
          key={d.month}
          className="flex flex-1 flex-col items-center gap-1"
        >
          <div className="flex h-[180px] w-full items-end justify-center gap-1">
            <BarTooltip label={`Receita: ${fmtBRL(d.receita)}`}>
              <div
                className="w-[40%] rounded-t-[4px] bg-primary transition-colors group-hover:bg-primary/80"
                style={{ height: `${(d.receita / max) * 100}%` }}
              />
            </BarTooltip>
            <BarTooltip label={`Despesa: ${fmtBRL(d.despesa)}`}>
              <div
                className="w-[40%] rounded-t-[4px] bg-chart-2 transition-colors group-hover:bg-chart-2/80"
                style={{ height: `${(d.despesa / max) * 100}%` }}
              />
            </BarTooltip>
          </div>
          <div className="text-[11px] font-medium text-on-surface-variant">
            {d.month}
          </div>
        </div>
      ))}
    </div>
  )
}

function BarTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="group relative flex h-full w-[40%] items-end">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-on-surface shadow-md opacity-0 transition-opacity group-hover:opacity-100"
      >
        {label}
      </div>
    </div>
  )
}
