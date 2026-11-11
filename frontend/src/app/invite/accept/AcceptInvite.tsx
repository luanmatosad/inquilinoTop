'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { acceptInviteAction } from './actions'
import { Button } from '@/components/ui/button'

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  // StrictMode executa o efeito duas vezes em dev; o convite só pode ser consumido uma vez.
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    acceptInviteAction(token).then((result) => {
      if (result.ok) {
        router.replace('/')
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }, [token, router])

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {error}
        </p>
        <Button asChild className="w-full">
          <Link href="/">Ir para o painel</Link>
        </Button>
      </div>
    )
  }

  return <p className="text-sm text-muted-foreground">Aceitando convite…</p>
}
