'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { SETTINGS_SECTIONS, activeSection } from '@/lib/settings-nav'

/** Desktop: menu lateral com todas as seções. Celular: só o "‹ Configurações" que volta à lista. */
export function SettingsNav() {
  const pathname = usePathname()
  const active = activeSection(pathname)
  return (
    <>
      {pathname !== '/settings' && (
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground md:hidden">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Configurações
        </Link>
      )}
      <nav aria-label="Seções de Configurações" className="hidden w-[220px] shrink-0 flex-col gap-0.5 md:flex">
        {SETTINGS_SECTIONS.map((s) =>
          s.href ? (
            <Link
              key={s.key}
              href={s.href}
              aria-current={active?.key === s.key ? 'page' : undefined}
              className={`flex min-h-8 items-center rounded-lg px-2.5 py-1 text-sm ${
                active?.key === s.key ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent/60'
              }`}
            >
              {s.label}
            </Link>
          ) : (
            <span key={s.key} aria-disabled="true" className="flex min-h-8 items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-sm text-muted-foreground">
              <span>{s.label}</span>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">Em breve</span>
            </span>
          ),
        )}
      </nav>
    </>
  )
}
