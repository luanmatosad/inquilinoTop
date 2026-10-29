'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

type AppShellProps = {
  header: ReactNode
  children: ReactNode
}

export function AppShell({ header, children }: AppShellProps) {
  const pathname = usePathname()
  const isAuthRoute = pathname?.startsWith('/login')

  if (isAuthRoute) {
    return <>{children}</>
  }

  return (
    <>
      {header}
      <main className="flex-1 md:ml-64 pt-16">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </>
  )
}
