'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Paperclip } from 'lucide-react'

import { confirmReport, rejectReport } from '@/app/financial/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** O que o inquilino informou, já formatado para a tela. */
export type ReportInfo = {
  paymentId: string
  tenantName: string
  reportedAmount: string
  /** "Hoje, 09:12". */
  reportedWhen: string
  hasProof: boolean
  /** O valor informado não bate com o devido hoje. */
  differsFromDue: boolean
  dueTotal: string
}

type Props = { open: boolean; info: ReportInfo | null; onClose: () => void; onDone: () => void }

const first = (name: string) => name.trim().split(/\s+/)[0] || name

/** Confirmar pagamento: o dono confere na conta e confirma ou diz que ainda não recebeu. O app não verifica o dinheiro. */
export function ConfirmReportDialog({ open, info, onClose, onDone }: Props) {
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null)
  if (!info) return null
  const name = first(info.tenantName)

  async function run(kind: 'confirm' | 'reject') {
    if (!info) return
    setBusy(kind)
    try {
      const result = await (kind === 'confirm' ? confirmReport(info.paymentId) : rejectReport(info.paymentId))
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(kind === 'confirm' ? 'Recebimento confirmado.' : 'Aviso recusado.')
      onDone()
      onClose()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar pagamento de {name}?</DialogTitle>
          <DialogDescription>Confira na sua conta antes de confirmar.</DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Informado por {name}</dt>
            <dd>{info.reportedWhen}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Valor</dt>
            <dd className="font-medium">{info.reportedAmount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Comprovante</dt>
            <dd>
              {info.hasProof ? (
                <a href={`/api/payments/${info.paymentId}/proof`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                  <Paperclip className="size-3.5" aria-hidden="true" />
                  Ver comprovante
                </a>
              ) : (
                'Sem comprovante'
              )}
            </dd>
          </div>
        </dl>

        {info.differsFromDue && (
          <p role="status" className="text-sm text-destructive dark:text-red-400">
            O valor devido hoje é {info.dueTotal}, diferente do informado. Se houver desconto, use Registrar pagamento.
          </p>
        )}

        <p className="text-sm text-muted-foreground">O comprovante é informado pelo inquilino. O ImoviFlow não verifica se o dinheiro entrou.</p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => run('reject')} disabled={busy !== null}>
            {busy === 'reject' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ainda não recebi
          </Button>
          <Button type="button" onClick={() => run('confirm')} disabled={busy !== null}>
            {busy === 'confirm' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar recebimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
