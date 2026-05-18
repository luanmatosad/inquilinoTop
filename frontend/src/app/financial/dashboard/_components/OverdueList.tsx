import * as React from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { fmtBRL } from '@/lib/format'
import type { Receivable } from '@/data/financial/dal'

// Lucide doesn't ship a WhatsApp mark. Inline the brand glyph and color it
// with the design-system's --color-whatsapp token via currentColor.
function WhatsappGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.2 1.1-1.7 1.2-.4 0-1 .1-1.6-.1l-1.5-.5c-2.6-1-4.3-3.6-4.5-3.8-.1-.2-1-1.4-1-2.6 0-1.3.7-1.9.9-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.5c-.2.2-.3.3-.1.6.3.4.9 1.5 2 2.4 1.4 1 2.5 1.3 2.8 1.4.3.1.5.1.7-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.3.1 1.7.8 2 .9.3.1.5.2.6.4 0 .2 0 .8-.2 1.4z" />
    </svg>
  )
}

interface OverdueItem
  extends Pick<Receivable, 'id' | 'payer' | 'property' | 'amount' | 'dueDate'> {}

export function OverdueList({ items }: { items: OverdueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-on-surface-variant">
        Nenhum atraso registrado.
      </div>
    )
  }

  const today = Date.now()

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const days = Math.max(
          0,
          Math.floor((today - new Date(item.dueDate).getTime()) / 86_400_000),
        )
        return (
          <li key={item.id} className="flex flex-col gap-2 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-on-surface">
                  {item.payer}
                </p>
                <p className="truncate text-[11px] text-on-surface-variant">
                  {item.property}
                </p>
              </div>
              <StatusBadge status="OVERDUE">{days} dias</StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold tabular-nums text-destructive">
                {fmtBRL(item.amount)}
              </span>
              <Link
                href={`/financial/receivables?charge=${item.id}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[color:var(--color-whatsapp)]/12 px-3 text-xs font-medium text-[#15803d] transition-colors hover:bg-[color:var(--color-whatsapp)]/20"
              >
                <WhatsappGlyph className="size-3.5" />
                Cobrar
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
