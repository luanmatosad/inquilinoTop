'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ellipsis } from 'lucide-react'

import { logout } from '@/app/auth/actions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { isNavItemActive, mobileTabs, moreItems } from '@/lib/nav'

type MobileTabBarProps = {
  user: { name?: string | null; email?: string | null }
}

const tabClass =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-accent-foreground'
const pillClass =
  'flex h-7 w-12 items-center justify-center rounded-full group-aria-[current=page]:bg-accent'

function initials(value: string): string {
  const parts = value.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]
  return letters.toUpperCase()
}

/** Barra inferior do celular (canvas: Mobile.dc.html / M-Mais.dc.html). Some a partir de md. */
export function MobileTabBar({ user }: MobileTabBarProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = moreItems.some((i) => isNavItemActive(pathname, i))
  const userName = user.name?.trim() || user.email || 'Usuário'

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card px-2 pb-2 pt-1 md:hidden"
      >
        {mobileTabs.map((item) => {
          const active = isNavItemActive(pathname, item)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn('group', tabClass)}
            >
              <span className={pillClass}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {item.mobileTab}
            </Link>
          )
        })}
        <button
          type="button"
          aria-current={moreActive ? 'page' : undefined}
          onClick={() => setMoreOpen(true)}
          className={cn('group', tabClass)}
        >
          <span className={pillClass}>
            <Ellipsis className="size-5" aria-hidden="true" />
          </span>
          Mais
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85svh] overflow-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Mais</SheetTitle>
            <SheetDescription className="sr-only">Outras áreas do sistema.</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col px-4">
            {moreItems.map((item) => (
              <li key={item.href} className="border-t first:border-t-0">
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-14 items-center text-[15px] font-medium"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mx-4 mb-4 flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback className="bg-muted text-sm">{initials(userName)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{userName}</span>
                {user.email && (
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                )}
              </div>
            </div>
            <form action={logout}>
              <Button type="submit" variant="outline" className="w-full text-destructive">
                Sair
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
