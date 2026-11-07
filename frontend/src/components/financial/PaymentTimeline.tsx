import type { TimelineRow } from '@/lib/receivable-detail'

/** Linha do tempo da cobrança: marcos e eventos em ordem cronológica. */
export function PaymentTimeline({ rows }: { rows: TimelineRow[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {rows.map((r) => (
        <li key={r.key} className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{r.title}</span>
            <span className="text-sm text-muted-foreground">{r.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}
