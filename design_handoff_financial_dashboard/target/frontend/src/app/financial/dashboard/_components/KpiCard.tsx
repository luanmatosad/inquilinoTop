import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Accent = 'primary' | 'success' | 'danger' | 'warning' | 'accent'

const ACCENT_TEXT: Record<Accent, string> = {
  primary: 'text-primary',
  success: 'text-[color:var(--color-success-600)]',
  danger: 'text-destructive',
  warning: 'text-[color:var(--color-warning-600)]',
  accent: 'text-secondary',
}

const ACCENT_BG: Record<Accent, string> = {
  primary: 'bg-primary',
  success: 'bg-[color:var(--color-success-600)]',
  danger: 'bg-destructive',
  warning: 'bg-[color:var(--color-warning-600)]',
  accent: 'bg-secondary',
}

export interface KpiCardProps {
  title: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  accent?: Accent
  progress?: number
  trend?: { direction: 'up' | 'down'; label: string }
}

export function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  accent = 'primary',
  progress,
  trend,
}: KpiCardProps) {
  return (
    <Card className="py-4 gap-3">
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-on-surface">{title}</span>
          {Icon ? <Icon className={cn('size-4', ACCENT_TEXT[accent])} /> : null}
        </div>

        <div className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-on-surface">
          {value}
        </div>

        {hint ? (
          <p className="text-xs text-on-surface-variant">{hint}</p>
        ) : null}

        {typeof progress === 'number' ? (
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-variant"
            role="progressbar"
            aria-valuenow={Math.min(100, progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn('h-full', ACCENT_BG[accent])}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        ) : null}

        {trend ? (
          <div
            className={cn(
              'mt-1 inline-flex items-center gap-1 text-[11px] font-medium',
              trend.direction === 'up'
                ? 'text-[color:var(--color-success-600)]'
                : 'text-destructive',
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {trend.label}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
