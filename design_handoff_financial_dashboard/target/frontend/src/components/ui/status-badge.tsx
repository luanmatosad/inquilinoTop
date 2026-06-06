import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Reusable status pill shared by the financial module.
 * Palette mirrors the InquilinoTop design system (preview/status-badges.html).
 * Add new statuses by extending PALETTE — do not invent ad-hoc colors at call sites.
 */

export type StatusKey =
  | 'PAID'
  | 'PENDING'
  | 'OVERDUE'
  | 'REVIEW'
  | 'RECONCILED'
  | 'NEW'
  | 'NEUTRAL'

interface PaletteEntry {
  /** Tailwind class for the pill background. */
  bg: string
  /** Tailwind class for the text + dot color. */
  fg: string
  /** Tailwind class for the leading dot fill. */
  dot: string
  /** Default Portuguese label when no children are passed. */
  label: string
}

const PALETTE: Record<StatusKey, PaletteEntry> = {
  PAID: {
    bg: 'bg-[#d1fadf]',
    fg: 'text-[#15803d]',
    dot: 'bg-[#22c55e]',
    label: 'Pago',
  },
  PENDING: {
    bg: 'bg-[#fff0c2]',
    fg: 'text-[#b45309]',
    dot: 'bg-[#f59e0b]',
    label: 'Pendente',
  },
  OVERDUE: {
    bg: 'bg-[#fee2e2]',
    fg: 'text-[#7f1010]',
    dot: 'bg-destructive',
    label: 'Atrasado',
  },
  REVIEW: {
    bg: 'bg-[#dbe7ff]',
    fg: 'text-[#00366f]',
    dot: 'bg-[#2563eb]',
    label: 'Em revisão',
  },
  RECONCILED: {
    bg: 'bg-[#eef2ff]',
    fg: 'text-[#3730a3]',
    dot: 'bg-[#646be3]',
    label: 'Conciliado',
  },
  NEW: {
    bg: 'bg-[#ffe5bf]',
    fg: 'text-[#6f3c00]',
    dot: 'bg-secondary',
    label: 'Novo',
  },
  NEUTRAL: {
    bg: 'bg-surface-container',
    fg: 'text-on-surface-variant',
    dot: 'bg-on-surface-variant',
    label: '—',
  },
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusKey
}

export function StatusBadge({
  status,
  children,
  className,
  ...rest
}: StatusBadgeProps) {
  const p = PALETTE[status] ?? PALETTE.NEUTRAL
  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        p.bg,
        p.fg,
        className,
      )}
      {...rest}
    >
      <span className={cn('size-1.5 rounded-full', p.dot)} />
      {children ?? p.label}
    </span>
  )
}
