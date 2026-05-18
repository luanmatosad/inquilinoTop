'use client'

import { cn } from '@/lib/utils'

interface ConfidencePillProps {
  value: number
  className?: string
}

export function ConfidencePill({ value, className }: ConfidencePillProps) {
  const pct = Math.round(value * 100)

  if (pct === 0) {
    return (
      <span className={cn('text-[12.5px] text-on-surface-variant', className)}>
        —
      </span>
    )
  }

  const tone = pct >= 95 ? 'high' : pct >= 80 ? 'mid' : 'low'
  const styles = {
    high: 'bg-[#d1fadf] text-[#15803d]',
    mid: 'bg-[#fff0c2] text-[#b45309]',
    low: 'bg-[#fee2e2] text-[#7f1010]',
  }

  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums',
        styles[tone],
        className,
      )}
      aria-label={`Confiança ${pct} por cento`}
    >
      {pct}%
    </span>
  )
}
