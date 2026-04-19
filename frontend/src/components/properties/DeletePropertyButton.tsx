"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { deleteProperty } from "@/app/properties/actions"

interface DeletePropertyButtonProps {
  id: string
  name: string
}

export function DeletePropertyButton({ id, name }: DeletePropertyButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault() // Prevent closing immediately
    setLoading(true)
    try {
      const result = await deleteProperty(id)
      if (result.error) {
        toast.error(result.error)
        setLoading(false)
        setOpen(false) // Close on error so user can retry or cancel
      } else {
        toast.success("Imóvel desativado com sucesso!")
        setOpen(false)
        router.push("/properties")
        router.refresh()
      }
    } catch (error) {
      toast.error("Erro ao desativar imóvel.")
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Desativar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar Imóvel?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso irá desativar o imóvel "{name}" e todas as suas unidades.
            Ele não aparecerá mais na lista principal.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Desativando..." : "Confirmar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
