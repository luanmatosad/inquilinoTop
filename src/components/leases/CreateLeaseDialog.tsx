'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { LeaseForm } from './LeaseForm'

interface CreateLeaseDialogProps {
  unitId: string
  tenants: any[] // Pode tipar melhor se quiser importar a interface
}

export function CreateLeaseDialog({ unitId, tenants }: CreateLeaseDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
            <Plus className="mr-2 h-4 w-4" /> Novo Contrato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Contrato de Locação</DialogTitle>
        </DialogHeader>
        <LeaseForm 
            unitId={unitId} 
            tenants={tenants} 
            onSuccess={() => setOpen(false)} 
            onCancel={() => setOpen(false)} 
        />
      </DialogContent>
    </Dialog>
  )
}
