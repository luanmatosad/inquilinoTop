'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { deleteTenant } from '@/app/tenants/actions'
import { TenantForm, type TenantFormData } from '@/components/tenants/TenantForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type TenantFormSheetProps = {
  /** Vem da URL (`?novo=1` na lista, `?editar=1` no detalhe). */
  open: boolean
  /** Presente = edição (com exclusão no rodapé); ausente = inquilino novo. */
  tenant?: TenantFormData
}

export function TenantFormSheet({ open, tenant }: TenantFormSheetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const param = tenant ? 'editar' : 'novo'
  const [isOpen, setIsOpen] = useState(open)
  const [prevOpen, setPrevOpen] = useState(open)
  const [confirming, setConfirming] = useState(false)

  // Acompanha a URL: se `open` mudou, ajusta o estado na própria renderização.
  if (open !== prevOpen) {
    setPrevOpen(open)
    setIsOpen(open)
  }

  function close() {
    setIsOpen(false)
    const next = new URLSearchParams(searchParams.toString())
    next.delete(param)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  async function handleDelete() {
    if (!tenant) return
    const result = await deleteTenant(tenant.id)
    if (result.error) {
      toast.error(result.error)
      setConfirming(false)
      return
    }
    toast.success('Inquilino excluído.')
    setConfirming(false)
    router.push('/tenants')
  }

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{tenant ? 'Editar inquilino' : 'Novo inquilino'}</SheetTitle>
          <SheetDescription>{tenant ? tenant.name : 'Nome e contato já bastam para começar.'}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-6 pb-6">
          <TenantForm initialData={tenant} onSuccess={close} onCancel={close} />

          {tenant && (
            <>
              <Separator />
              <Button
                type="button"
                variant="ghost"
                className="self-start text-destructive hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                Excluir inquilino
              </Button>
            </>
          )}
        </div>

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este inquilino?</AlertDialogTitle>
              <AlertDialogDescription>
                O cadastro sai da lista e das buscas. Quem tem contrato ativo não pode ser excluído.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Confirmar exclusão</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
