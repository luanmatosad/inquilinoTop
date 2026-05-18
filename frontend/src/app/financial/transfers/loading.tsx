import { TableSkeleton } from '@/components/financial/shared'

const HEADERS = ['Proprietário', 'Imóveis', 'Recebimento bruto', 'Taxa adm.', 'Descontos', 'Líquido', 'Status', '']
const COL_WIDTHS: (number | [number, number])[] = [140, 80, 90, 80, 80, 90, 80, 80]

export default function TransfersLoading() {
  return (
    <div className="space-y-5 pb-16">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div
            className="animate-shimmer h-7 w-36 rounded-md"
            style={{
              background: 'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
              backgroundSize: '400px 100%',
            }}
          />
          <div
            className="animate-shimmer h-4 w-72 rounded-md"
            style={{
              background: 'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
              backgroundSize: '400px 100%',
            }}
          />
        </div>
      </div>

      {/* Summary banner skeleton */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div
              className="animate-shimmer h-3 w-56 rounded"
              style={{
                background: 'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
                backgroundSize: '400px 100%',
              }}
            />
            <div
              className="animate-shimmer h-8 w-44 rounded"
              style={{
                background: 'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
                backgroundSize: '400px 100%',
              }}
            />
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <TableSkeleton headers={HEADERS} columnWidths={COL_WIDTHS} rows={4} />
    </div>
  )
}
