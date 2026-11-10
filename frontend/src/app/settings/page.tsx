import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { SETTINGS_SECTIONS } from '@/lib/settings-nav'

/** Lista de seções (o `M-Config-lista` do canvas). No desktop o menu lateral faz o mesmo papel. */
export default function SettingsIndexPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 md:hidden">
        <h1 className="text-2xl font-semibold leading-[1.2]">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajuste o ImoviFlow do seu jeito.</p>
      </div>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {SETTINGS_SECTIONS.map((s) => (
          <li key={s.key}>
            {s.href ? (
              <Link href={s.href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-accent/40">
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{s.description}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            ) : (
              <div aria-disabled="true" className="flex min-h-14 items-center gap-3 px-4 py-3 text-muted-foreground">
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-xs">{s.description}</span>
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">Em breve</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
