'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { TenantForm } from './TenantForm'
import { deleteTenant, toggleTenantStatus } from '@/app/tenants/actions'
import { toast } from 'sonner'

interface Tenant {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  document?: string | null
  is_active: boolean
}

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
    } catch (error) {
      toast.error('Erro ao remover inquilino.')
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const result = await toggleTenantStatus(id, !currentStatus)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Inquilino ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`)
      }
    } catch (error) {
      toast.error('Erro ao alterar status.')
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
          <DialogContent>
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
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum inquilino cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{tenant.email || '-'}</span>
                      <span className="text-muted-foreground">{tenant.phone || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{tenant.document || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={tenant.is_active ? 'outline' : 'destructive'}>
                      {tenant.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleToggleStatus(tenant.id, tenant.is_active)}
                      title={tenant.is_active ? "Desativar" : "Ativar"}
                    >
                      {tenant.is_active ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </Button>
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
        <DialogContent>
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
              Isso ir&aacute; remover permanentemente o inquilino &quot;{deletingTenant?.name}&quot;. 
              Cuidado: Se ele tiver contratos ativos, isso pode gerar inconsist&ecirc;ncias.
              Recomendamos apenas desativar.
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
