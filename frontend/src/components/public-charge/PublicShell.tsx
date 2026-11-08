import type { ReactNode } from 'react'

import { initials } from '@/lib/public-charge'

/** Moldura da página pública: coluna estreita (390px do canvas), sem menu nem login. */
export function PublicShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background md:border-x">
      <header className="flex min-h-14 items-center border-b px-4 py-1.5">
        <h1 className="text-xl font-semibold leading-[1.2]">{title}</h1>
      </header>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </main>
  )
}

export function LandlordLine({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-medium">
        {initials(name)}
      </span>
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">Cobrança de aluguel</div>
      </div>
    </div>
  )
}
