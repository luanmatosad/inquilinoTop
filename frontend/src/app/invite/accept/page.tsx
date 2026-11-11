import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { hasSession } from '@/lib/session'
import { AcceptInvite } from './AcceptInvite'

type InviteAcceptPageProps = {
  searchParams: Promise<{ token?: string }>
}

export default async function InviteAcceptPage({ searchParams }: InviteAcceptPageProps) {
  const { token } = await searchParams

  if (typeof token !== 'string' || token === '') {
    return (
      <Frame>
        <p role="alert" className="text-sm text-destructive">
          Link de convite inválido: o token não foi informado.
        </p>
      </Frame>
    )
  }

  if (!hasSession(await cookies())) {
    const back = `/invite/accept?token=${encodeURIComponent(token)}`
    return (
      <Frame>
        <p className="text-sm text-muted-foreground">
          Entre na sua conta para aceitar o convite.
        </p>
        <Button asChild className="w-full">
          <Link href={`/login?next=${encodeURIComponent(back)}`}>Entrar para aceitar</Link>
        </Button>
      </Frame>
    )
  }

  return (
    <Frame>
      <AcceptInvite key={token} token={token} />
    </Frame>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="flex w-full max-w-[418px] flex-col gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Convite para organização</h1>
        {children}
      </div>
    </div>
  )
}
