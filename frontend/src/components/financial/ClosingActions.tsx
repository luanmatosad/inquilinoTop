'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { closeMonth, reopenMonth } from '@/app/financial/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  month: string
  /** "outubro de 2026". */
  monthLabel: string
  mode: 'close' | 'reopen'
  /** "com 1 pendência (Bruno Lima)": só no fechar. */
  pendingText?: string
}

/** Botão + diálogo: Fechar {mês} (confirma) ou Reabrir mês (pede o motivo). */
export function ClosingActions({ month, monthLabel, mode, pendingText }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const monthName = monthLabel.split(' ')[0]

  async function run() {
    setBusy(true)
    setError('')
    try {
      const result = await (mode === 'close' ? closeMonth(month) : reopenMonth(month, reason))
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success(mode === 'close' ? `${monthName} fechado.` : `${monthName} reaberto.`)
      setOpen(false)
      setReason('')
      router.refresh()
    } catch {
      setError('Ocorreu um erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant={mode === 'close' ? 'default' : 'outline'} onClick={() => setOpen(true)} className="print:hidden">
        {mode === 'close' ? `Fechar ${monthName}` : 'Reabrir mês'}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'close' ? `Fechar ${monthLabel}?` : `Reabrir ${monthLabel}?`}</DialogTitle>
            <DialogDescription>
              {mode === 'close'
                ? `Os números do mês ficam guardados ${pendingText ?? ''}. Dá para reabrir depois.`.replace(' .', '.')
                : 'O retrato fechado deixa de valer e o mês volta a ser calculado ao vivo. O motivo fica no histórico.'}
            </DialogDescription>
          </DialogHeader>
          {mode === 'reopen' && (
            <label className="flex flex-col gap-1 text-sm">
              Motivo
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: corrigir uma baixa" />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" onClick={run} disabled={busy || (mode === 'reopen' && reason.trim().length < 3)}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'close' ? `Fechar ${monthName}` : 'Reabrir mês'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
