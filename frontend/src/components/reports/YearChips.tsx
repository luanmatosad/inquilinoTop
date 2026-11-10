import Link from 'next/link'

/** Seletor de ano por URL (`?ano=`). */
export function YearChips({ basePath, active, years }: { basePath: string; active: number; years: number[] }) {
  return (
    <nav aria-label="Ano" className="flex gap-2 overflow-x-auto print:hidden">
      {years.map((y) => (
        <Link
          key={y}
          href={`${basePath}?ano=${y}`}
          aria-current={y === active ? 'true' : undefined}
          className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[13px] font-medium md:h-7 ${
            y === active ? 'border-accent bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-accent'
          }`}
        >
          {y}
        </Link>
      ))}
    </nav>
  )
}
