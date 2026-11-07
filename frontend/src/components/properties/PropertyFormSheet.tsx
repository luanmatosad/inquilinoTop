"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { PropertyForm } from "@/components/properties/PropertyForm"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type PropertyFormSheetProps = {
  /** Vem da URL (`?novo=1`): permite link direto e o botão voltar fecha o painel. */
  open: boolean
}

export function PropertyFormSheet({ open }: PropertyFormSheetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Estado local para fechar na hora, sem esperar a navegação do servidor.
  const [isOpen, setIsOpen] = useState(open)
  const [prevOpen, setPrevOpen] = useState(open)

  // Acompanha a URL: se `open` mudou (ex.: voltou a ter ?novo=1), ajusta o estado na própria renderização.
  if (open !== prevOpen) {
    setPrevOpen(open)
    setIsOpen(open)
  }

  function close() {
    setIsOpen(false)
    const next = new URLSearchParams(searchParams.toString())
    next.delete("novo")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>Novo imóvel</SheetTitle>
          <SheetDescription>Cadastre o prédio, a casa ou o ponto comercial.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <PropertyForm onSuccess={close} onCancel={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
