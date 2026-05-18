import { TableSkeleton } from '@/components/financial/shared'

const HEADERS = ['Vencimento', 'Beneficiário / Imóvel', 'Categoria', 'Valor', 'Forma', 'Status', '']
const COL_WIDTHS: (number | [number, number])[] = [90, [160, 220], 90, 90, 50, 70, 20]

export default function PayablesLoading() {
  return (
    <div className="space-y-5 pb-16">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div
            className="animate-shimmer h-7 w-44 rounded-md"
            style={{
              background: 'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
              backgroundSize: '400px 100%',
            }}
          />
          <div
            className="animate-shimmer h-4 w-80 rounded-md"
            style={{
              background: 'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
              backgroundSize: '400px 100%',
            }}
          />
        </div>
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div
              className="animate-shimmer h-3 w-20 rounded"
              style={{
                background: 'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
                backgroundSize: '400px 100%',
              }}
            />
            <div
              className="animate-shimmer h-6 w-28 rounded"
              style={{
                background: 'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
                backgroundSize: '400px 100%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <TableSkeleton headers={HEADERS} columnWidths={COL_WIDTHS} rows={6} />
    </div>
  )
}
