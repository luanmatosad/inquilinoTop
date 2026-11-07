'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { isPublicRoute } from '@/lib/nav'

type AppShellProps = {
  /** Sidebar do usuário autenticado. Não há modo visitante: sem sessão o middleware redireciona para /login. */
  sidebar: ReactNode
  header: ReactNode
  children: ReactNode
}

const SIDEBAR_WIDTH = '15rem' // 240px (Figma)

export function AppShell({ sidebar, header, children }: AppShellProps) {
  const pathname = usePathname()

  if (isPublicRoute(pathname)) {
    return <>{children}</>
  }

  return (
    // `open` fixo: no desktop a sidebar é sempre visível (sem colapsar por ⌘B);
    // no mobile ela vira um drawer (Sheet) aberto pelo botão do cabeçalho.
    <SidebarProvider
      open
      onOpenChange={() => {}}
      style={{ '--sidebar-width': SIDEBAR_WIDTH } as React.CSSProperties}
    >
      {sidebar}
      <SidebarInset className="min-w-0">
        {header}
        {/* pb-24: espaço para a barra inferior fixa do celular. */}
        <div className="flex-1 p-4 pb-24 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
