'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { TenantForm, type TenantFormData } from './TenantForm'
import { deleteTenant } from '@/app/tenants/actions'
import { maskCpfCnpj, maskPhone } from '@/lib/masks'
import { toast } from 'sonner'

type Tenant = TenantFormData & { is_active: boolean }

interface TenantListClientProps {
  tenants: Tenant[]
}

export function TenantListClient({ tenants }: TenantListClientProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null)

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant)
  }

  const handleDelete = async () => {
    if (!deletingTenant) return

    try {
      const result = await deleteTenant(deletingTenant.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Inquilino removido com sucesso!')
        setDeletingTenant(null)
      }
    } catch {
      toast.error('Erro ao remover inquilino.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inquilinos</h1>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo Inquilino
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Inquilino</DialogTitle>
            </DialogHeader>
            <TenantForm 
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
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Nenhum inquilino cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">
                    <Link href={`/tenants/${tenant.id}`} className="hover:underline">{tenant.name}</Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{tenant.email || '-'}</span>
                      <span className="text-muted-foreground">{tenant.phone ? maskPhone(tenant.phone) : '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{tenant.document ? maskCpfCnpj(tenant.document) : '-'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEdit(tenant)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => setDeletingTenant(tenant)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTenant} onOpenChange={(open) => !open && setEditingTenant(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Inquilino</DialogTitle>
          </DialogHeader>
          {editingTenant && (
            <TenantForm
              initialData={editingTenant}
              onSuccess={() => setEditingTenant(null)}
              onCancel={() => setEditingTenant(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={!!deletingTenant} onOpenChange={(open) => !open && setDeletingTenant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              O inquilino &quot;{deletingTenant?.name}&quot; deixa de aparecer na lista, mas o histórico
              é mantido. Não é possível excluir quem tem contrato ativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
