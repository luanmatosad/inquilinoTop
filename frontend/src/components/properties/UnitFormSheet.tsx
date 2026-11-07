"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { UnitForm } from "@/components/properties/UnitForm"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { UnitFormValues } from "@/lib/schemas"

type UnitFormSheetProps = {
  propertyId: string
  propertyName: string
  /** Presente = edição; ausente = unidade nova. */
  unit?: UnitFormValues & { id: string }
  /** Vem da URL (`?unidade=nova` ou `?unidade=<id>`). */
  open: boolean
}

export function UnitFormSheet({ propertyId, propertyName, unit, open }: UnitFormSheetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(open)
  const [prevOpen, setPrevOpen] = useState(open)

  // Acompanha a URL: se `open` mudou, ajusta o estado na própria renderização.
  if (open !== prevOpen) {
    setPrevOpen(open)
    setIsOpen(open)
  }

  function close() {
    setIsOpen(false)
    const next = new URLSearchParams(searchParams.toString())
    next.delete("unidade")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>{unit ? "Editar unidade" : "Adicionar unidade"}</SheetTitle>
          <SheetDescription>{propertyName}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <p className="text-sm text-muted-foreground">
            O endereço é o do imóvel, então não precisa preencher de novo.
          </p>
          <UnitForm propertyId={propertyId} initialData={unit} onSuccess={close} onCancel={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
