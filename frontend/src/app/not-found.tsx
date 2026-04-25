import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <SearchX className="h-8 w-8" />
        <h2 className="text-2xl font-bold">404 - Página não encontrada</h2>
      </div>
      <p className="text-muted-foreground text-center">
        A página que você está procurando não existe ou foi movida.
      </p>
      <Link href="/">
        <Button variant="outline">Voltar para o início</Button>
      </Link>
    </div>
  )
}
