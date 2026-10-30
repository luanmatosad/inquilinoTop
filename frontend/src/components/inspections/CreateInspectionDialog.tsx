'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InspectionForm } from './InspectionForm'
import type { LeaseOption } from '@/lib/inspection-data'

export function CreateInspectionDialog({ leases, leaseId, label = 'Novo Laudo' }: { leases: LeaseOption[]; leaseId?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />{label}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo laudo de vistoria</DialogTitle></DialogHeader>
        <InspectionForm leases={leases} leaseId={leaseId} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
