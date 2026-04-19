'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-6 w-6" />
        <h2 className="text-lg font-semibold">Algo deu errado!</h2>
      </div>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error.message || 'Ocorreu um erro inesperado. Por favor, tente novamente.'}
      </p>
      <Button onClick={() => reset()}>Tentar novamente</Button>
    </div>
  )
}
