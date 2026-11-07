'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { commandGroups } from '@/lib/nav'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Paleta de comandos: navega entre páginas (sem busca de dados). Abre com ⌘K / Ctrl+K. */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pesquisar no sistema"
      description="Navegue entre as páginas do sistema."
    >
      <Command>
        <CommandInput placeholder="Ir para..." />
        <CommandList>
          <CommandEmpty>Nenhuma página encontrada.</CommandEmpty>
          {commandGroups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.href}
                    value={`${group.label} ${item.label}`}
                    onSelect={() => go(item.href)}
                  >
                    <Icon aria-hidden="true" />
                    {item.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
