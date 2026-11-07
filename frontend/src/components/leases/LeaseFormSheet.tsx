'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { LeaseForm, type LeaseEditData, type LeaseTenantOption, type LeaseUnitOption } from '@/components/leases/LeaseForm'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type LeaseFormSheetProps = {
  /** Vem da URL (`?novo=1` na lista, `?editar=1` no detalhe). */
  open: boolean
  units: LeaseUnitOption[]
  tenants: LeaseTenantOption[]
  defaultUnitId?: string
  defaultTenantId?: string
  /** Presente = edição. */
  lease?: LeaseEditData
}

export function LeaseFormSheet({ open, units, tenants, defaultUnitId, defaultTenantId, lease }: LeaseFormSheetProps) {
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
    for (const k of lease ? ['editar'] : ['novo', 'inquilino', 'unidade']) next.delete(k)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{lease ? 'Editar contrato' : 'Novo contrato'}</SheetTitle>
          <SheetDescription>
            {lease ? 'Unidade, inquilino e início não mudam. Para trocar, encerre e crie outro.' : 'Escolha a unidade e o inquilino e defina o aluguel.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <LeaseForm
            units={units}
            tenants={tenants}
            defaultUnitId={defaultUnitId}
            defaultTenantId={defaultTenantId}
            lease={lease}
            onSuccess={close}
            onCancel={close}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
