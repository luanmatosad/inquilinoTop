'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { ConfirmReportDialog, type ReportInfo } from '@/components/financial/ConfirmReportDialog'
import { Button } from '@/components/ui/button'

/** Resumo do aviso do inquilino na cobrança, com o botão que abre o diálogo de confirmação. */
export function ReportNotice({ info, summary }: { info: ReportInfo; summary: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground">{summary}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Confirmar
      </Button>
      <ConfirmReportDialog open={open} info={info} onClose={() => setOpen(false)} onDone={() => router.refresh()} />
    </div>
  )
}
