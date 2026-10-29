'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { LeaseForm } from './LeaseForm'

interface Tenant {
  id: string
  name: string
  document?: string | null
}

interface Property {
  id: string
  name: string
  units: { id: string; label: string }[]
}

interface CreateLeaseDialogProps {
  unitId?: string
  tenants: Tenant[]
  properties?: Property[]
}

export function CreateLeaseDialog({ unitId, tenants, properties }: CreateLeaseDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
            <Plus className="mr-2 h-4 w-4" /> Novo Contrato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Contrato de Locação</DialogTitle>
        </DialogHeader>
        <LeaseForm 
            unitId={unitId} 
            tenants={tenants} 
            properties={properties}
            onSuccess={() => setOpen(false)} 
            onCancel={() => setOpen(false)} 
        />
      </DialogContent>
    </Dialog>
  )
}
