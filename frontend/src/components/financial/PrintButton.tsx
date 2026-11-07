'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Abre o diálogo de impressão do navegador; lá, "Salvar como PDF" gera o arquivo. */
export function PrintButton({ label = 'Imprimir', primary = false }: { label?: string; primary?: boolean }) {
  return (
    <Button variant={primary ? 'default' : 'outline'} onClick={() => window.print()}>
      <Printer className="w-4 h-4 mr-2" /> {label}
    </Button>
  )
}
