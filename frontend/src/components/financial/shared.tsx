'use client'

import * as React from 'react'
import { AlertTriangle, ArrowLeftRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* ─── TableSkeleton ─────────────────────────────────────────────────────────── */

interface TableSkeletonProps {
  headers: string[]
  columnWidths: (number | [number, number])[]
  rows?: number
  rowClassName?: string
}

export function TableSkeleton({
  headers,
  columnWidths,
  rows = 6,
  rowClassName,
}: TableSkeletonProps) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="bg-surface-variant">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  'px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant',
                  i === columnWidths.length - 1 || h === 'Valor'
                    ? 'text-right'
                    : 'text-left',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri} className="border-t border-border">
              {columnWidths.map((w, ci) => {
                const isRight =
                  ci === columnWidths.length - 1 || headers[ci] === 'Valor'
                return (
                  <td
                    key={ci}
                    className={cn(
                      rowClassName ?? 'py-3 px-4',
                      isRight && 'text-right',
                    )}
                  >
                    {Array.isArray(w) ? (
                      <div className="flex flex-col gap-1.5">
                        <ShimmerBar w={w[0]} h={11} />
                        <ShimmerBar w={w[1]} h={9} />
                      </div>
                    ) : (
                      <ShimmerBar w={w} h={11} inline={isRight} />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function ShimmerBar({
  w,
  h,
  inline,
}: {
  w: number
  h: number
  inline?: boolean
}) {
  return (
    <span
      className={cn(
        inline ? 'inline-block' : 'block',
        'animate-shimmer rounded-[4px]',
      )}
      style={{
        width: w,
        height: h,
        background:
          'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
        backgroundSize: '400px 100%',
      }}
    />
  )
}

/* ─── ErrorState ────────────────────────────────────────────────────────────── */

export function ErrorState({
  title = 'Não foi possível carregar os dados',
  body = 'Houve um erro de comunicação com o serviço financeiro. Verifique sua conexão e tente novamente.',
  onRetry,
}: {
  title?: string
  body?: string
  onRetry: () => void
}) {
  return (
    <Card className="px-6 py-10 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-red-100 text-red-900">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="text-base font-semibold text-on-surface">{title}</h3>
      <p className="mx-auto mt-1 mb-4 max-w-sm text-sm text-on-surface-variant leading-relaxed">
        {body}
      </p>
      <Button onClick={onRetry}>
        <ArrowLeftRight className="size-3.5" />
        Tentar novamente
      </Button>
    </Card>
  )
}

/* ─── EmptyState ────────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <Card className="px-6 py-14 text-center">
      <div className="mx-auto mb-3.5 grid size-14 place-items-center rounded-[14px] bg-surface-container text-on-surface-variant">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-semibold text-on-surface">{title}</h3>
      <p className="mx-auto mt-1 mb-4 max-w-md text-sm text-on-surface-variant leading-relaxed">
        {body}
      </p>
      {action}
    </Card>
  )
}

/* ─── Spinner ───────────────────────────────────────────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white',
        className,
      )}
    />
  )
}
