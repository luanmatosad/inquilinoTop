'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Bell, CircleHelp, Plus, Search } from 'lucide-react'

import { CommandPalette } from '@/components/CommandPalette'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const subscribeNoop = () => () => {}

function getShortcutHint(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform || nav.platform || ''
  return /mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl K'
}

/** Barra superior do usuário autenticado (Figma ImoveFlow 114:4724, 48px). */
export function TopBar() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  // Atalho depende do SO; no servidor é null, então a dica só aparece no cliente.
  const shortcutHint = useSyncExternalStore(subscribeNoop, getShortcutHint, () => null)

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger
          variant="outline"
          size="icon"
          className="md:hidden"
          aria-label="Abrir menu"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setPaletteOpen(true)}
          aria-label="Pesquisar no sistema"
          aria-keyshortcuts="Meta+K Control+K"
          className="max-sm:size-8 max-sm:px-0 sm:w-full sm:max-w-[466px] sm:justify-start"
        >
          <Search aria-hidden="true" />
          <span className="hidden flex-1 text-left sm:inline">Pesquisar no sistema</span>
          {shortcutHint && (
            <Kbd className="hidden sm:inline-flex" aria-hidden="true">
              {shortcutHint}
            </Kbd>
          )}
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button asChild variant="outline" size="icon">
          <Link href="/owner/settings" aria-label="Notificações">
            <Bell aria-hidden="true" />
          </Link>
        </Button>
        <div className="hidden h-8 w-2 justify-center sm:flex">
          <Separator orientation="vertical" />
        </div>
        <Button asChild variant="outline" size="icon">
          <Link href="/support" aria-label="Ajuda e suporte">
            <CircleHelp aria-hidden="true" />
          </Link>
        </Button>
        <ThemeToggle />
        <Button asChild className="gap-1 max-sm:size-8 max-sm:px-0">
          <Link href="/properties/new">
            <Plus aria-hidden="true" />
            <span className="max-sm:sr-only">Novo imóvel</span>
          </Link>
        </Button>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  )
}
