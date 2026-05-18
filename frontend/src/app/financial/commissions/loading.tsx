import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

function ShimmerBar({ w, h }: { w: number; h: number }) {
  return <Skeleton className="rounded" style={{ width: w, height: h }} />
}

export default function CommissionsLoading() {
  return (
    <main className="space-y-5 px-8 py-6 pb-16">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <ShimmerBar w={160} h={28} />
          <ShimmerBar w={420} h={14} />
        </div>
        <div className="flex gap-2">
          <ShimmerBar w={100} h={36} />
          <ShimmerBar w={140} h={36} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4 space-y-2">
            <ShimmerBar w={80} h={11} />
            <ShimmerBar w={100} h={22} />
            <ShimmerBar w={120} h={10} />
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border">
        {['Locação', 'Venda', 'Captação'].map(t => (
          <div key={t} className="px-4 py-2.5">
            <ShimmerBar w={60} h={14} />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <Card className="p-3 flex gap-3">
        <ShimmerBar w={280} h={36} />
        <ShimmerBar w={120} h={36} />
        <ShimmerBar w={100} h={36} />
      </Card>

      {/* Table skeleton */}
      <Card className="overflow-hidden p-0">
        <table className="w-full border-collapse">
          <thead className="bg-surface-variant">
            <tr>
              {['', 'Corretor', 'Imóvel / operação', 'Base', '%', 'IRRF', 'Líquido', 'Status', ''].map((h, i) => (
                <th key={i} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, ri) => (
              <tr key={ri} className="border-t border-border">
                <td className="px-4 py-3"><ShimmerBar w={14} h={14} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ShimmerBar w={32} h={32} />
                    <div className="space-y-1.5">
                      <ShimmerBar w={120} h={12} />
                      <ShimmerBar w={80} h={10} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1.5">
                    <ShimmerBar w={160} h={12} />
                    <ShimmerBar w={120} h={10} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right"><ShimmerBar w={80} h={11} /></td>
                <td className="px-4 py-3 text-right"><ShimmerBar w={30} h={11} /></td>
                <td className="px-4 py-3 text-right"><ShimmerBar w={50} h={11} /></td>
                <td className="px-4 py-3 text-right"><ShimmerBar w={80} h={11} /></td>
                <td className="px-4 py-3"><ShimmerBar w={80} h={20} /></td>
                <td className="px-4 py-3"><ShimmerBar w={20} h={20} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  )
}
