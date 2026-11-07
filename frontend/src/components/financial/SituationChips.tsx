import Link from 'next/link'

export type Chip = { value: string; label: string; count: number }

/** Chips de situação por URL (`?situacao=`), mantendo o mês. `value` vazio = Todas. */
export function SituationChips({ basePath, ym, active, chips }: { basePath: string; ym: string; active?: string; chips: Chip[] }) {
  return (
    <nav aria-label="Situação" className="flex gap-2 overflow-x-auto">
      {chips.map((c) => {
        const params = new URLSearchParams({ mes: ym })
        if (c.value) params.set('situacao', c.value)
        const on = (active ?? '') === c.value
        return (
          <Link
            key={c.value || 'ALL'}
            href={`${basePath}?${params.toString()}`}
            aria-current={on ? 'true' : undefined}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
              on ? 'border-accent bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-accent'
            }`}
          >
            {c.label} · {c.count}
          </Link>
        )
      })}
    </nav>
  )
}
