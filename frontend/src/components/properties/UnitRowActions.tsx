"use client"

import { useState } from "react"
import Link from "next/link"
import { FileText, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteUnit } from "@/app/properties/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type UnitRowActionsProps = { propertyId: string; unitId: string; label: string; isActive: boolean }

/** Menu da linha: detalhes/contrato, editar (painel por URL) e desativar (exclusão lógica, com confirmação). */
export function UnitRowActions({ propertyId, unitId, label, isActive }: UnitRowActionsProps) {
  const [confirming, setConfirming] = useState(false)

  async function handleDelete() {
    try {
      const result = await deleteUnit(unitId, propertyId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Unidade desativada com sucesso!")
      setConfirming(false)
    } catch {
      toast.error("Erro ao desativar unidade.")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações de ${label}`}>
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/units/${unitId}`}>
              <FileText aria-hidden="true" /> Detalhes / Contrato
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/properties/${propertyId}?unidade=${unitId}`}>
              <Pencil aria-hidden="true" /> Editar
            </Link>
          </DropdownMenuItem>
          {isActive && (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" /> Desativar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá desativar a unidade &quot;{label}&quot;. Contratos e histórico continuam guardados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Confirmar desativação</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
