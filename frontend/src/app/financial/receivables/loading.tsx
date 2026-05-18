import { TableSkeleton } from '@/components/financial/shared'

const HEADERS = ['Vencimento', 'Pagador / Imóvel', 'Competência', 'Valor', 'Forma', 'Status', '']
const COL_WIDTHS: (number | [number, number])[] = [90, [160, 220], 60, 90, 50, 70, 20]

export default function ReceivablesLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div
            className="animate-shimmer h-7 w-52 rounded-md"
            style={{
              background:
                'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
              backgroundSize: '400px 100%',
            }}
          />
          <div
            className="animate-shimmer h-4 w-72 rounded-md"
            style={{
              background:
                'linear-gradient(90deg, var(--container) 0%, var(--surface-variant) 50%, var(--container) 100%)',
              backgroundSize: '400px 100%',
            }}
          />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-6 border-b border-border">
        {['Aluguel', 'Outras cobranças'].map((label) => (
          <div key={label} className="pb-3 text-sm font-medium text-on-surface-variant">
            {label}
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <TableSkeleton headers={HEADERS} columnWidths={COL_WIDTHS} rows={6} />
    </div>
  )
}
