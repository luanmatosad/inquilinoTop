"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, MoreVertical, Pencil, Trash2, FileText } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import { UnitForm } from "./UnitForm"
import { deleteUnit } from "@/app/properties/actions"
import { toast } from "sonner"

export interface Unit {
  id: string
  label: string
  floor?: string
  notes?: string
  is_active: boolean
}

interface UnitListProps {
  propertyId: string
  units: Unit[]
  defaultOpenAdd?: boolean // To handle the redirect with ?addUnit=true
}

export function UnitList({ propertyId, units, defaultOpenAdd = false }: UnitListProps) {
  const [isAddOpen, setIsAddOpen] = useState(defaultOpenAdd)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null)

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit)
  }

  const handleDelete = async () => {
    if (!deletingUnit) return

    try {
      const result = await deleteUnit(deletingUnit.id, propertyId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Unidade desativada com sucesso!")
        setDeletingUnit(null)
      }
    } catch (error) {
      toast.error("Erro ao desativar unidade.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Unidades</h2>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Unidade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Nova Unidade</DialogTitle>
            </DialogHeader>
            <UnitForm 
              propertyId={propertyId} 
              onSuccess={() => setIsAddOpen(false)}
              onCancel={() => setIsAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identificação</TableHead>
              <TableHead>Andar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Nenhuma unidade cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.label}</TableCell>
                  <TableCell>{unit.floor || "-"}</TableCell>
                  <TableCell>
                    {unit.is_active ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/units/${unit.id}`} className="cursor-pointer flex items-center w-full">
                            <FileText className="mr-2 h-4 w-4" /> Detalhes / Contrato
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(unit)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        {unit.is_active && (
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeletingUnit(unit)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Desativar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingUnit} onOpenChange={(open) => !open && setEditingUnit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Unidade</DialogTitle>
          </DialogHeader>
          {editingUnit && (
            <UnitForm
              propertyId={propertyId}
              initialData={editingUnit}
              onSuccess={() => setEditingUnit(null)}
              onCancel={() => setEditingUnit(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={!!deletingUnit} onOpenChange={(open) => !open && setDeletingUnit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso ir&aacute; desativar a unidade &quot;{deletingUnit?.label}&quot;. Voc&ecirc; poder&aacute; reativ&aacute;-la posteriormente se necess&aacute;rio (via admin ou futura feature).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Confirmar Desativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
